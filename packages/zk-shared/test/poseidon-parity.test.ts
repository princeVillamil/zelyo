import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildLeaf, idCommitment, type Attributes, type FieldHex } from "../src/index.js";

interface Vector {
  name: string;
  s: string;
  attributes: Attributes;
  expectedLeaf: string | null;
}

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, "fixtures/parity-vectors.json"), "utf8"),
) as { vectors: Vector[] };

describe("Poseidon parity (JS leaf == circuit leaf)", () => {
  for (const v of fixture.vectors) {
    if (v.expectedLeaf === null) {
      // Phase 0: rig is stood up but the circuit-derived expected value is not
      // yet available. Phase 1 fills expectedLeaf and removes this branch.
      it.todo(`${v.name}: expectedLeaf pending circuit derivation (Phase 1)`);
      continue;
    }
    it(`${v.name}: JS-computed leaf matches the circuit`, () => {
      const leaf = buildLeaf(idCommitment(v.s as FieldHex), v.attributes);
      expect(leaf).toBe(v.expectedLeaf);
    });
  }
});
