import { describe, it, expect, beforeEach, vi } from "vitest";
import { IMT } from "@zk-kit/imt";
import { poseidon, type FieldHex, MERKLE_DEPTH } from "@zelyo/zk-shared";

const store = {
  tree: { id: "tree1", depth: MERKLE_DEPTH, rootHex: "", leafCount: 0 },
  leaves: [] as { treeId: string; index: number; leafHex: string }[],
};

vi.mock("@/lib/db", () => ({
  db: {
    merkleTree: {
      findFirstOrThrow: vi.fn(async () => store.tree),
      update: vi.fn(async ({ data }: { data: { rootHex: string; leafCount: number } }) => {
        store.tree = { ...store.tree, ...data };
        return store.tree;
      }),
    },
    leaf: {
      findMany: vi.fn(async () => [...store.leaves].sort((a, b) => a.index - b.index)),
      create: vi.fn(async ({ data }: { data: { treeId: string; index: number; leafHex: string } }) => {
        store.leaves.push(data);
        return { id: `leaf${data.index}`, ...data };
      }),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn((await import("@/lib/db")).db)),
  },
}));

import { insertLeaf, getMerkleProof, getCurrentRoot } from "./merkle.service";

const toHex = (n: number): FieldHex =>
  ("0x" + n.toString(16).padStart(64, "0")) as FieldHex;

// Reference tree using the SAME poseidon as zk-shared, for parity.
function refTree(leaves: FieldHex[]): IMT {
  const hash = (inputs: bigint[]): bigint =>
    BigInt(poseidon(inputs.map((n) => ("0x" + n.toString(16).padStart(64, "0")) as FieldHex)));
  return new IMT(hash, MERKLE_DEPTH, 0n, 2, leaves.map((l) => BigInt(l)));
}

describe("merkle.service", () => {
  beforeEach(() => {
    store.tree = { id: "tree1", depth: MERKLE_DEPTH, rootHex: "", leafCount: 0 };
    store.leaves = [];
  });

  it("insertLeaf returns sequential indices and updates the root", async () => {
    const a = await insertLeaf(toHex(11));
    const b = await insertLeaf(toHex(22));
    expect(a.index).toBe(0);
    expect(b.index).toBe(1);
    expect(b.rootHex).not.toBe(a.rootHex);
    expect(await getCurrentRoot()).toBe(b.rootHex);
  });

  it("getMerkleProof produces siblings that verify against the current root", async () => {
    await insertLeaf(toHex(11));
    await insertLeaf(toHex(22));
    const proof = await getMerkleProof(1);
    const ref = refTree([toHex(11), toHex(22)]);
    const refProof = ref.createProof(1);
    expect(proof.rootHex).toBe(("0x" + ref.root.toString(16).padStart(64, "0")) as FieldHex);
    expect(proof.siblings.map((s) => BigInt(s))).toEqual(refProof.siblings.map((s) => BigInt(s[0])));
    expect(proof.pathIndices).toEqual(refProof.pathIndices);
  });
});
