import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { poseidon, idCommitment, buildLeaf, computeNullifier } from "../src/index.js";
import type { FieldHex } from "../src/index.js";

interface Vector {
  s: FieldHex;
  scope: FieldHex;
  attributes: { track: FieldHex; grade: FieldHex; issueDate: FieldHex };
  idCommitment: FieldHex;
  attrHash: FieldHex;
  leaf: FieldHex;
  nullifier: FieldHex;
}

const fixturePath = fileURLToPath(new URL("./fixtures/parity-vectors.json", import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as { vectors: Vector[] };

describe("Poseidon parity: JS builders == Noir circuit", () => {
  it("has at least one golden vector", () => {
    expect(fixture.vectors.length).toBeGreaterThan(0);
  });

  for (const [i, v] of fixture.vectors.entries()) {
    it(`vector ${i}: idCommitment(s) matches circuit`, () => {
      expect(idCommitment(v.s)).toBe(v.idCommitment);
    });

    it(`vector ${i}: Poseidon(track,grade,issueDate) matches circuit attrHash`, () => {
      const attrHash = poseidon([v.attributes.track, v.attributes.grade, v.attributes.issueDate]);
      expect(attrHash).toBe(v.attrHash);
    });

    it(`vector ${i}: leaf = Poseidon(idCommitment, attrHash) matches circuit`, () => {
      const leaf = poseidon([v.idCommitment, v.attrHash]);
      expect(leaf).toBe(v.leaf);
    });

    it(`vector ${i}: nullifier = Poseidon(s, scope) matches circuit`, () => {
      expect(computeNullifier(v.s, v.scope)).toBe(v.nullifier);
    });
  }
});

// Smoke: buildLeaf end-to-end produces a 32-byte FieldHex (string-packed path).
import type { Attributes } from "../src/index.js";
describe("buildLeaf end-to-end", () => {
  it("produces a valid FieldHex leaf", () => {
    const attrs: Attributes = {
      track: "Data Engineering",
      grade: "A",
      issueDate: "2026-06-01",
      courseName: "Distributed Systems",
      learnerName: "Ada Lovelace",
    };
    const leaf = buildLeaf(idCommitment("0x3039" as FieldHex), attrs);
    expect(leaf).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
