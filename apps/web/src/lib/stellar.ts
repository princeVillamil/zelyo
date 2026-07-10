import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  rpc,
  Keypair,
  Contract,
  TransactionBuilder,
  Transaction,
  FeeBumpTransaction,
  BASE_FEE,
  Address,
  nativeToScVal,
  Asset,
  Claimant,
  Horizon,
  Operation,
  xdr,
} from "@stellar/stellar-sdk";
import type { FieldHex, ProofBundle, PublicInputs } from "@zelyo/zk-shared";
import { env } from "./env";
import { AppError } from "./errors";
import { submitSponsored } from "./channels";

export class ContractError extends Error {
  constructor(
    public readonly contractError: "NullifierUsed" | "UnknownRoot" | "AddressMismatch" | "InvalidProof",
  ) {
    super(contractError);
    this.name = "ContractError";
  }
}

// Single source of truth lives in ./explorer; re-exported here for back-compat
// (verification.service imports it from @/lib/stellar).
export { explorerTxUrl } from "./explorer";

export const rpcServer = new rpc.Server(env.SOROBAN_RPC_URL, {
  allowHttp: env.SOROBAN_RPC_URL.startsWith("http://"),
});
export const issuerKeypair = Keypair.fromSecret(env.ISSUER_SECRET);

/** 0x-prefixed 32-byte field hex -> 32-byte Buffer (BytesN<32>). */
export function hexToBytes32(hex: FieldHex): Buffer {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length !== 64) throw new Error("root must be 32 bytes (64 hex chars)");
  return Buffer.from(clean, "hex");
}

/** True if `address` is a Soroban contract address (C... StrKey). */
export function isContractAddress(address: string): boolean {
  return address.startsWith("C") && address.length === 56;
}

/** Convert a human-readable Stellar amount to the chain's smallest unit (stroops, 7 decimals). */
export function toStroops(amount: string): bigint {
  const parts = amount.split(".");
  const whole = parts[0] ?? "0";
  const fraction = parts[1] ?? "";
  const sign = whole.startsWith("-") ? "-" : "";
  const absWhole = whole.replace(/^-/, "") || "0";
  const frac = fraction.padEnd(7, "0").slice(0, 7);
  return BigInt(`${sign}${absWhole}${frac}`);
}

/** Option to route a transaction through a fee sponsor instead of direct RPC/Horizon. */
export type SponsorOption = { sponsor?: "channels" };

/** Submit a Soroban transaction directly or via Launchtube fee sponsorship, then poll. */
async function submitSorobanSponsoredOrDirect(
  tx: Transaction,
  opts?: SponsorOption,
): Promise<{ txHash: string }> {
  if (opts?.sponsor === "channels") {
    const xdr = tx.toEnvelope().toXDR("base64");
    const result = await submitSponsored(xdr);
    const polled = await pollTransaction(result.hash);
    if (polled.status !== "SUCCESS") {
      throw new Error(`Soroban transaction failed after Channels submission: ${polled.status}`);
    }
    return { txHash: result.hash };
  }

  const sent = await rpcServer.sendTransaction(tx);
  const result = await pollTransaction(sent.hash);
  if (result.status !== "SUCCESS") {
    throw new Error(`Soroban transaction failed: ${result.status}`);
  }
  return { txHash: sent.hash };
}

/** Submit a classic Stellar transaction directly via Horizon or via Launchtube fee sponsorship. */
async function submitClassicSponsoredOrDirect(
  tx: Transaction,
  opts?: SponsorOption,
): Promise<{ txHash: string }> {
  if (opts?.sponsor === "channels") {
    const xdr = tx.toEnvelope().toXDR("base64");
    const result = await submitSponsored(xdr);
    return { txHash: result.hash };
  }

  const server = new Horizon.Server(env.HORIZON_URL);
  const res = await server.submitTransaction(tx);
  return { txHash: res.hash };
}

/** Build an ScVal map matching the contract's `PublicInputsXdr` struct. */
function publicInputsToScVal(pi: PublicInputs): xdr.ScVal {
  const b32 = (hex: FieldHex) => xdr.ScVal.scvBytes(Buffer.from(hex.slice(2), "hex"));
  // ScMap keys must be sorted lexicographically by symbol name.
  const entries = [
    { key: "bound_address", val: b32(pi.boundAddress) },
    { key: "disclosed", val: b32(pi.disclosed.value) },
    { key: "nullifier", val: b32(pi.nullifier) },
    { key: "root", val: b32(pi.root) },
    { key: "scope", val: b32(pi.scope) },
  ].sort((a, b) => a.key.localeCompare(b.key));
  return xdr.ScVal.scvMap(
    entries.map(({ key, val }) => new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(key), val })),
  );
}

/** Simulate a read-only view function that returns bool. */
async function simulateBool(method: string, ...args: xdr.ScVal[]): Promise<boolean> {
  const contract = new Contract(env.CREDENTIAL_REGISTRY_CONTRACT_ID);
  const source = await rpcServer.getAccount(issuerKeypair.publicKey());

  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: env.NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
    .build();

  const sim = await rpcServer.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`simulate ${method} failed: ${sim.error}`);
  }
  if (!sim.result) {
    throw new Error(`simulate ${method} returned no result`);
  }
  const val = sim.result.retval;
  if (val.switch().name !== "scvBool") {
    throw new Error(`simulate ${method} returned non-bool: ${val.switch().name}`);
  }
  return val.b();
}

export async function isRootValid(root: FieldHex): Promise<boolean> {
  return simulateBool(
    "is_root_valid",
    nativeToScVal(hexToBytes32(root), { type: "bytes" }),
  );
}

export async function isNullifierUsed(nullifier: FieldHex): Promise<boolean> {
  return simulateBool(
    "is_nullifier_used",
    nativeToScVal(hexToBytes32(nullifier), { type: "bytes" }),
  );
}

export async function verifyProofOffchain(bundle: ProofBundle): Promise<boolean> {
  // vk is the raw bytes produced by `bb write_vk`.
  const vkPath = join(process.cwd(), "public", "circuit", "vk");
  const vk = await readFile(vkPath);

  // Public inputs must be in the exact circuit order: root | scope | bound_address | nullifier | disclosed.
  const { root, scope, boundAddress, nullifier, disclosed } = bundle.publicInputs;
  const publicInputs = [root, scope, boundAddress, nullifier, disclosed.value];



  const { Barretenberg, UltraHonkBackend } = await import("@aztec/bb.js");
  // Load WASM from public/circuit/wasm/ instead of node_modules (avoids pnpm symlink issues).
  const wasmPath = join(process.cwd(), "public", "circuit", "wasm", "barretenberg-threads.wasm.gz");
  const acirPath = join(process.cwd(), "public", "circuit", "zelyo_credential.json");
  const acir = JSON.parse(await readFile(acirPath, "utf8"));
  const api = await Barretenberg.new({ threads: 1, wasmPath });
  try {
    const backend = new UltraHonkBackend(acir.bytecode, api);
    const result = await backend.verifyProof({
      proof: bundle.proof as Uint8Array,
      publicInputs: publicInputs as unknown as string[],
    });
    return result;
  } finally {
    await api.destroy();
  }
}

/** Poll a Soroban transaction until it reaches a terminal state. */
async function pollTransaction(
  txHash: string,
  opts: { maxAttempts?: number; intervalMs?: number } = {},
): Promise<rpc.Api.GetTransactionResponse> {
  const { maxAttempts = 20, intervalMs = 1_000 } = opts;
  for (let i = 0; i < maxAttempts; i++) {
    const tx = await rpcServer.getTransaction(txHash);
    if (tx.status === "SUCCESS" || tx.status === "NOT_FOUND") {
      // Keep polling on NOT_FOUND; other statuses are terminal.
      if (tx.status === "SUCCESS") return tx;
    } else {
      return tx;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`transaction ${txHash} did not reach terminal state in time`);
}

/** Submit `CredentialRegistry.register(pi, attestor, holder)` signed by ISSUER_SECRET (Path B). */
export async function submitRegister(
  pi: PublicInputs,
  boundStellarAddress: string,
  opts?: SponsorOption,
): Promise<{ txHash: string }> {
  const contract = new Contract(env.CREDENTIAL_REGISTRY_CONTRACT_ID);
  const source = await rpcServer.getAccount(issuerKeypair.publicKey());

  const op = contract.call(
    "register",
    publicInputsToScVal(pi),
    new Address(env.ISSUER_STELLAR_ACCOUNT).toScVal(),
    new Address(boundStellarAddress).toScVal(),
  );

  let tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: env.NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(60)
    .build();

  tx = await rpcServer.prepareTransaction(tx);
  tx.sign(issuerKeypair);

  try {
    return await submitSorobanSponsoredOrDirect(tx, opts);
  } catch (err) {
    // Re-check chain state to map the failure reason for the UI.
    if (!(await isRootValid(pi.root))) {
      throw new ContractError("UnknownRoot");
    }
    if (await isNullifierUsed(pi.nullifier)) {
      throw new ContractError("NullifierUsed");
    }
    throw new ContractError("InvalidProof");
  }
}

/** Submit `CredentialRegistry.verify_and_register(proof, pi, holder)` signed by ISSUER_SECRET (Path A).
 *  NOTE: Path A is disabled on the current Soroban testnet, which lacks the BN254
 *  pairing / Poseidon host functions required to verify an UltraHonk proof on-chain.
 *  `ZK_VERIFY_MODE` defaults to `server`; this builder is kept only so the wiring
 *  does not bit-rot until the protocol supports real on-chain verification. */
export async function submitVerifyAndRegister(
  bundle: ProofBundle,
  boundStellarAddress: string,
  opts?: SponsorOption,
): Promise<{ txHash: string }> {
  const contract = new Contract(env.CREDENTIAL_REGISTRY_CONTRACT_ID);
  const source = await rpcServer.getAccount(issuerKeypair.publicKey());

  const op = contract.call(
    "verify_and_register",
    xdr.ScVal.scvBytes(Buffer.from(bundle.proof)),
    publicInputsToScVal(bundle.publicInputs),
    new Address(boundStellarAddress).toScVal(),
  );

  let tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: env.NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(60)
    .build();

  tx = await rpcServer.prepareTransaction(tx);
  tx.sign(issuerKeypair);

  try {
    return await submitSorobanSponsoredOrDirect(tx, opts);
  } catch (err) {
    // Re-check chain state to map the failure reason for the UI.
    if (!(await isRootValid(bundle.publicInputs.root))) {
      throw new ContractError("UnknownRoot");
    }
    if (await isNullifierUsed(bundle.publicInputs.nullifier)) {
      throw new ContractError("NullifierUsed");
    }
    throw new ContractError("InvalidProof");
  }
}

/**
 * Publish a Merkle root on-chain via CredentialRegistry.set_root(issuer, root).
 * Signed server-side with ISSUER_SECRET. Returns the submitted tx hash.
 */
export async function publishRoot(rootHex: FieldHex, opts?: SponsorOption): Promise<{ txHash: string }> {
  const contract = new Contract(env.CREDENTIAL_REGISTRY_CONTRACT_ID);
  const source = await rpcServer.getAccount(issuerKeypair.publicKey());

  const op = contract.call(
    "set_root",
    new Address(env.ISSUER_STELLAR_ACCOUNT).toScVal(),
    nativeToScVal(hexToBytes32(rootHex), { type: "bytes" }),
  );

  let tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: env.NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(60)
    .build();

  tx = await rpcServer.prepareTransaction(tx);
  tx.sign(issuerKeypair);

  return submitSorobanSponsoredOrDirect(tx, opts);
}

/** Issue a direct payment of `asset` to `boundAddress`. Signed by ISSUER_SECRET.
 *  Used for native XLM so funds land immediately in the holder's wallet.
 *  Claimable balances are kept for custom assets; a holder-signed claim step
 *  could be added later for those. */
export async function issuePayment(
  boundAddress: string,
  asset: { code: string; issuer: string; amount: string },
  opts?: SponsorOption,
): Promise<{ txHash: string }> {
  const server = new Horizon.Server(env.HORIZON_URL);
  const source = await server.loadAccount(issuerKeypair.publicKey());
  const stellarAsset = asset.issuer ? new Asset(asset.code, asset.issuer) : Asset.native();
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: env.NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.payment({
        destination: boundAddress,
        asset: stellarAsset,
        amount: asset.amount,
      }),
    )
    .setTimeout(60)
    .build();
  tx.sign(issuerKeypair);
  return submitClassicSponsoredOrDirect(tx, opts);
}

/** Issue a testnet claimable balance of `asset` claimable by `boundAddress`. Signed by ISSUER_SECRET. */
export async function issueClaimableBalance(
  boundAddress: string,
  asset: { code: string; issuer: string; amount: string },
  opts?: SponsorOption,
): Promise<{ txHash: string }> {
  const server = new Horizon.Server(env.HORIZON_URL);
  const source = await server.loadAccount(issuerKeypair.publicKey());
  const claimant = new Claimant(boundAddress, Claimant.predicateUnconditional());
  // Native XLM has no issuer — `new Asset("XLM", "")` would be encoded as a credit asset
  // with an empty issuer and fail XDR serialization. Use Asset.native() when no issuer.
  const stellarAsset = asset.issuer ? new Asset(asset.code, asset.issuer) : Asset.native();
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: env.NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.createClaimableBalance({
        asset: stellarAsset,
        amount: asset.amount,
        claimants: [claimant],
      }),
    )
    .setTimeout(60)
    .build();
  tx.sign(issuerKeypair);
  return submitClassicSponsoredOrDirect(tx, opts);
}

/**
 * Issue a reward to a Soroban contract address (e.g. a passkey smart wallet)
 * via the asset's Stellar Asset Contract. For assets issued by the Zelyo issuer
 * account we use SAC `mint`, which matches the classic semantics where an
 * issuer can pay out its own asset without pre-holding it. For other assets
 * (including native XLM) we use SAC `transfer` from the issuer's SAC balance.
 */
export async function issueSorobanAsset(
  boundAddress: string,
  asset: { code: string; issuer: string; amount: string },
  opts?: SponsorOption,
): Promise<{ txHash: string }> {
  const stellarAsset = asset.issuer ? new Asset(asset.code, asset.issuer) : Asset.native();
  const contract = new Contract(stellarAsset.contractId(env.NETWORK_PASSPHRASE));
  const source = await rpcServer.getAccount(issuerKeypair.publicKey());
  const amountStroops = toStroops(asset.amount);

  const isIssuerAsset = asset.issuer === env.ISSUER_STELLAR_ACCOUNT;
  const args = isIssuerAsset
    ? [new Address(boundAddress).toScVal(), nativeToScVal(amountStroops, { type: "i128" })]
    : [
        new Address(env.ISSUER_STELLAR_ACCOUNT).toScVal(),
        new Address(boundAddress).toScVal(),
        nativeToScVal(amountStroops, { type: "i128" }),
      ];

  let tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: env.NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(isIssuerAsset ? "mint" : "transfer", ...args))
    .setTimeout(60)
    .build();

  tx = await rpcServer.prepareTransaction(tx);
  tx.sign(issuerKeypair);

  return submitSorobanSponsoredOrDirect(tx, opts);
}

/** Flip is_verified(address)=true on the registry contract. Signed by ISSUER_SECRET.
 *  NOTE: the CredentialRegistry contract currently has no `set_verified` method;
 *  this helper is preserved for when the contract is extended. */
export async function setVerifiedFlag(
  boundAddress: string,
  opts?: SponsorOption,
): Promise<{ txHash: string }> {
  const source = await rpcServer.getAccount(issuerKeypair.publicKey());
  const contract = new Contract(env.CREDENTIAL_REGISTRY_CONTRACT_ID);
  const built = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: env.NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "set_verified",
        new Address(boundAddress).toScVal(),
        nativeToScVal(true),
      ),
    )
    .setTimeout(60)
    .build();
  const prepared = await rpcServer.prepareTransaction(built);
  prepared.sign(issuerKeypair);
  return submitSorobanSponsoredOrDirect(prepared, opts);
}

/** Re-sign an existing transaction envelope (base64 XDR) with ISSUER_SECRET.
 *  Used by the SEP-8 approval server to co-sign regulated-asset payments.
 *  Rejects fee-bump transactions. */
export function signTransactionEnvelope(envelopeXdr: string): string {
  const tx = TransactionBuilder.fromXDR(envelopeXdr, env.NETWORK_PASSPHRASE);
  if (tx instanceof FeeBumpTransaction) {
    throw new AppError("UNSUPPORTED_TX", 400, "Fee-bump transactions are not supported for SEP-8 approval.");
  }
  tx.sign(issuerKeypair);
  return tx.toEnvelope().toXDR("base64");
}
