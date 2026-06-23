import { describe, it, expect } from "vitest";
import {
  poseidon,
  idCommitment,
  buildLeaf,
  computeNullifier,
  computeScope,
  toFieldHex,
} from "../src/index.js";
import type { Attributes, FieldHex } from "../src/index.js";

const F = (n: bigint) => toFieldHex(n);

describe("poseidon builders", () => {
  it("poseidon is deterministic and returns FieldHex", () => {
    const a = poseidon([F(1n), F(2n)]);
    const b = poseidon([F(1n), F(2n)]);
    expect(a).toBe(b);
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("idCommitment(s) == poseidon([s])", () => {
    const s = F(12345n);
    expect(idCommitment(s)).toBe(poseidon([s]));
  });

  it("computeNullifier(s, scope) == poseidon([s, scope])", () => {
    const s = F(12345n);
    const scope = F(999n);
    expect(computeNullifier(s, scope)).toBe(poseidon([s, scope]));
  });

  it("buildLeaf folds idCommitment with the attribute hash", () => {
    const attrs: Attributes = {
      track: "Data Engineering",
      grade: "A",
      issueDate: "2026-06-01",
      courseName: "Distributed Systems",
      learnerName: "Ada Lovelace",
    };
    const idc = idCommitment(F(12345n));
    const leaf = buildLeaf(idc, attrs);
    expect(leaf).toMatch(/^0x[0-9a-f]{64}$/);
    // changing an attribute changes the leaf
    const leaf2 = buildLeaf(idc, { ...attrs, grade: "B" });
    expect(leaf2).not.toBe(leaf);
  });

  it("computeScope is order-sensitive and deterministic", () => {
    const s1 = computeScope("zelyo-v1", "testnet", "CABC");
    const s2 = computeScope("zelyo-v1", "testnet", "CABC");
    const s3 = computeScope("zelyo-v1", "testnet", "CXYZ");
    expect(s1).toBe(s2);
    expect(s1).not.toBe(s3);
  });
});
