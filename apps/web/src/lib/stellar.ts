import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  rpc,
  Keypair,
  Contract,
  TransactionBuilder,
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

/** Build an ScVal map matching the contract's `PublicInputsXdr` struct. */
function publicInputsToScVal(pi: PublicInputs): xdr.ScVal {
  const b32 = (hex: FieldHex) => xdr.ScVal.scvBytes(Buffer.from(hex.slice(2), "hex"));
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("root"), val: b32(pi.root) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("scope"), val: b32(pi.scope) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("bound_address"), val: b32(pi.boundAddress) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("nullifier"), val: b32(pi.nullifier) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("disclosed"), val: b32(pi.disclosed) }),
  ]);
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
  const publicInputs = [root, scope, boundAddress, nullifier, disclosed];

  const { Barretenberg, UltraHonkVerifierBackend } = await import("@aztec/bb.js");
  const api = await Barretenberg.new({ threads: 1 });
  try {
    const verifier = new UltraHonkVerifierBackend(api);
    return await verifier.verifyProof(
      { proof: bundle.proof, publicInputs, verificationKey: vk },
      { verifierTarget: "evm-no-zk" },
    );
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

  const sent = await rpcServer.sendTransaction(tx);
  const result = await pollTransaction(sent.hash);

  if (result.status !== "SUCCESS") {
    // Re-check chain state to map the failure reason for the UI.
    if (!(await isRootValid(pi.root))) {
      throw new ContractError("UnknownRoot");
    }
    if (await isNullifierUsed(pi.nullifier)) {
      throw new ContractError("NullifierUsed");
    }
    throw new ContractError("InvalidProof");
  }

  return { txHash: sent.hash };
}

export async function submitVerifyAndRegister(_bundle: ProofBundle): Promise<{ txHash: string }> {
  /* Path A: verify_and_register(proof, pi) signed by ISSUER_SECRET; throws ContractError on revert */
  throw new Error("not implemented in this phase; mocked in tests, wired in Phase 7");
}

/**
 * Publish a Merkle root on-chain via CredentialRegistry.set_root(issuer, root).
 * Signed server-side with ISSUER_SECRET. Returns the submitted tx hash.
 */
export async function publishRoot(rootHex: FieldHex): Promise<{ txHash: string }> {
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

  const sent = await rpcServer.sendTransaction(tx);
  return { txHash: sent.hash };
}

/** Issue a testnet claimable balance of `asset` claimable by `boundAddress`. Signed by ISSUER_SECRET. */
export async function issueClaimableBalance(
  boundAddress: string,
  asset: { code: string; issuer: string; amount: string },
): Promise<{ txHash: string }> {
  const server = new Horizon.Server(env.HORIZON_URL);
  const source = await server.loadAccount(issuerKeypair.publicKey());
  const claimant = new Claimant(boundAddress, Claimant.predicateUnconditional());
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: env.NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.createClaimableBalance({
        asset: new Asset(asset.code, asset.issuer),
        amount: asset.amount,
        claimants: [claimant],
      }),
    )
    .setTimeout(60)
    .build();
  tx.sign(issuerKeypair);
  const res = await server.submitTransaction(tx);
  return { txHash: res.hash };
}

/** Flip is_verified(address)=true on the registry contract. Signed by ISSUER_SECRET. */
export async function setVerifiedFlag(boundAddress: string): Promise<{ txHash: string }> {
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
  const sent = await rpcServer.sendTransaction(prepared);
  return { txHash: sent.hash };
}
