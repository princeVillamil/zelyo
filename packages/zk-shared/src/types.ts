// Cross-phase contract types (index §zk-shared). The Poseidon builders live in
// poseidon.ts; the BN254 field helpers in field.ts.

// Field element as 0x-prefixed lowercase hex, 32 bytes. Branded for safety.
export type FieldHex = string & { readonly __brand: "FieldHex" };

export interface Attributes {
  track: string; // disclosed predicate target
  grade: string;
  issueDate: string; // ISO 8601
  courseName: string;
  learnerName: string;
}

export interface PublicInputs {
  root: FieldHex;
  scope: FieldHex;
  boundAddress: FieldHex; // Stellar ed25519 pubkey, field-packed
  nullifier: FieldHex;
  disclosed: FieldHex; // hash/encoding of the revealed attribute (track)
}

export interface ProofBundle {
  proof: Uint8Array;
  publicInputs: PublicInputs;
}

export const MERKLE_DEPTH = 20;
