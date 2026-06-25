import "server-only";
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

export async function isRootValid(_root: FieldHex): Promise<boolean> {
  /* invoke CredentialRegistry.is_root_valid via Soroban RPC */
  throw new Error("not implemented in this phase; mocked in tests, wired in Phase 7");
}
export async function isNullifierUsed(_nullifier: FieldHex): Promise<boolean> {
  /* invoke is_nullifier_used */
  throw new Error("not implemented in this phase; mocked in tests, wired in Phase 7");
}
export async function submitVerifyAndRegister(_bundle: ProofBundle): Promise<{ txHash: string }> {
  /* Path A: verify_and_register(proof, pi) signed by ISSUER_SECRET; throws ContractError on revert */
  throw new Error("not implemented in this phase; mocked in tests, wired in Phase 7");
}
export async function submitRegister(_pi: PublicInputs): Promise<{ txHash: string }> {
  /* Path B: register(pi, attestor) signed by ISSUER_SECRET; throws ContractError on revert */
  throw new Error("not implemented in this phase; mocked in tests, wired in Phase 7");
}
export async function verifyProofOffchain(_bundle: ProofBundle): Promise<boolean> {
  /* Path B: bb.js / nargo verify server-side */
  throw new Error("not implemented in this phase; mocked in tests, wired in Phase 7");
}
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
        nativeToScVal(true, { type: "bool" }),
      ),
    )
    .setTimeout(60)
    .build();
  const prepared = await rpcServer.prepareTransaction(built);
  prepared.sign(issuerKeypair);
  const sent = await rpcServer.sendTransaction(prepared);
  return { txHash: sent.hash };
}
