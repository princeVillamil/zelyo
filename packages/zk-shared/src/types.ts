// Cross-phase contract types. Signatures are locked here (index §zk-shared);
// the Poseidon implementation + real builders land in Phase 1.

// Field element as 0x-prefixed lowercase hex, 32 bytes. Branded for safety.
export type FieldHex = string & { readonly __brand: "FieldHex" };

export interface Attributes {
  track: string; // disclosed predicate target
  grade: string;
  issueDate: string; // ISO 8601
  courseName: string;
  learnerName: string;
}

export const MERKLE_DEPTH = 20 as const;

const NOT_YET = "implemented in Phase 1 — see 2026-06-23-zelyo-02-zk-circuit.md";

// Poseidon over BN254 — MUST match circuit params (parity-tested in Phase 1).
export function idCommitment(_s: FieldHex): FieldHex {
  throw new Error(`idCommitment ${NOT_YET}`);
}

// leaf = Poseidon(idCommitment, Poseidon(attributes))
export function buildLeaf(_idCommitment: FieldHex, _attributes: Attributes): FieldHex {
  throw new Error(`buildLeaf ${NOT_YET}`);
}

// nullifier = Poseidon(s, scope)
export function computeNullifier(_s: FieldHex, _scope: FieldHex): FieldHex {
  throw new Error(`computeNullifier ${NOT_YET}`);
}
