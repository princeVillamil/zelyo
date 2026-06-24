import "server-only";
import { IMT } from "@zk-kit/imt";
import { db } from "@/lib/db";
import { poseidon, type FieldHex, MERKLE_DEPTH } from "@zelyo/zk-shared";
import { AppError } from "@/lib/errors";

const ZERO = 0n;
const ARITY = 2;

function toFieldHex(n: bigint): FieldHex {
  return ("0x" + n.toString(16).padStart(64, "0")) as FieldHex;
}

// Poseidon over BN254 — MUST be the zk-shared impl for circuit parity.
// @zk-kit/imt calls the hash with an array of child node values.
function hash(inputs: bigint[]): bigint {
  return BigInt(poseidon(inputs.map(toFieldHex)));
}

// Rebuild the in-memory tree from persisted, index-ordered leaves.
async function loadTree(): Promise<{ tree: IMT; treeId: string }> {
  const row = await db.merkleTree.findFirstOrThrow();
  const leaves = await db.leaf.findMany({
    where: { treeId: row.id },
    orderBy: { index: "asc" },
    select: { index: true, leafHex: true },
  });
  // Guard against gaps — indices must be 0..n-1 contiguous.
  leaves.forEach((l, i) => {
    if (l.index !== i) throw new AppError("MERKLE_CORRUPT", 500, "Merkle leaf index gap detected");
  });
  const tree = new IMT(hash, MERKLE_DEPTH, ZERO, ARITY, leaves.map((l) => BigInt(l.leafHex)));
  return { tree, treeId: row.id };
}

export async function insertLeaf(leafHex: FieldHex): Promise<{ index: number; rootHex: FieldHex }> {
  const { tree, treeId } = await loadTree();
  const index = tree.leaves.length;
  tree.insert(BigInt(leafHex));
  const rootHex = toFieldHex(tree.root);
  await db.$transaction(async (tx) => {
    await tx.leaf.create({ data: { treeId, index, leafHex } });
    await tx.merkleTree.update({ where: { id: treeId }, data: { rootHex, leafCount: index + 1 } });
  });
  return { index, rootHex };
}

export async function getMerkleProof(
  leafIndex: number,
): Promise<{ siblings: FieldHex[]; pathIndices: number[]; rootHex: FieldHex }> {
  const { tree } = await loadTree();
  if (leafIndex < 0 || leafIndex >= tree.leaves.length) {
    throw new AppError("LEAF_NOT_FOUND", 404, "Merkle leaf index out of range");
  }
  const proof = tree.createProof(leafIndex);
  return {
    siblings: proof.siblings.map((s) => toFieldHex(BigInt(s[0]))),
    pathIndices: proof.pathIndices,
    rootHex: toFieldHex(tree.root),
  };
}

export async function getCurrentRoot(): Promise<FieldHex> {
  const { tree } = await loadTree();
  return toFieldHex(tree.root);
}
