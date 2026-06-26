import { buildLeaf, type Attributes, type FieldHex } from "@zelyo/zk-shared";

/**
 * A credential is "orphaned" when the Merkle leaf rebuilt from the holder's
 * CURRENT id_commitment no longer matches the leaf stored at mint time — i.e. it
 * was issued under a previous identity (a "Generate Identity" replaced the key)
 * and can no longer be proven from this device. Revoked leaves are intentionally
 * zeroed, so only ACTIVE credentials are checked. If the leaf can't be rebuilt at
 * all (malformed attributes), it isn't provable either, so we treat it as orphaned.
 */
export function isCredentialOrphaned(args: {
  currentCommitment: string | null | undefined;
  status: "ACTIVE" | "REVOKED";
  attributes: unknown;
  leafHex: string;
}): boolean {
  if (args.status !== "ACTIVE" || !args.currentCommitment) return false;
  try {
    return (
      buildLeaf(args.currentCommitment as FieldHex, args.attributes as Attributes) !== args.leafHex
    );
  } catch {
    return true;
  }
}
