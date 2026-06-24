import { poseidon2Hash } from "@zkpassport/poseidon2";
import type { Attributes, FieldHex } from "./types.js";
import { toFieldHex, fieldHexToBigInt, BN254_MODULUS } from "./field.js";

// Wraps the circuit-parity Poseidon2 permutation (same BN254 params as Noir's
// `poseidon::poseidon2::Poseidon2::hash`). Inputs/outputs are FieldHex so the
// rest of the app never juggles bigints. Parity is gated by parity.test.ts.
export function poseidon(inputs: FieldHex[]): FieldHex {
  if (inputs.length === 0) throw new Error("poseidon requires at least one input");
  const out: bigint = poseidon2Hash(inputs.map(fieldHexToBigInt));
  return toFieldHex(out % BN254_MODULUS);
}

// id_commitment = Poseidon(s)
export function idCommitment(s: FieldHex): FieldHex {
  return poseidon([s]);
}

// nullifier = Poseidon(s, scope)
export function computeNullifier(s: FieldHex, scope: FieldHex): FieldHex {
  return poseidon([s, scope]);
}

// Map an arbitrary UTF-8 string to a BN254 field by folding its bytes into a
// big-endian integer then reducing. Used for string attributes + scope parts.
function stringToField(value: string): FieldHex {
  const bytes = new TextEncoder().encode(value);
  let acc = 0n;
  for (const b of bytes) acc = (acc << 8n) | BigInt(b);
  return toFieldHex(acc % BN254_MODULUS);
}

// Only track/grade/issueDate are folded into the credential hash (mirrors the
// circuit's AttributesF). courseName/learnerName stay off-circuit.
export function attributesToFields(a: Attributes): [FieldHex, FieldHex, FieldHex] {
  return [stringToField(a.track), stringToField(a.grade), stringToField(a.issueDate)];
}

// leaf = Poseidon( idCommitment, Poseidon(track, grade, issueDate) )
export function buildLeaf(idCommitmentHex: FieldHex, attributes: Attributes): FieldHex {
  const [track, grade, issueDate] = attributesToFields(attributes);
  const attrHash = poseidon([track, grade, issueDate]);
  return poseidon([idCommitmentHex, attrHash]);
}

// scope = Poseidon( H(app_id), H(chain_id), H(registry_id) )
export function computeScope(appId: string, chainId: string, registryId: string): FieldHex {
  return poseidon([stringToField(appId), stringToField(chainId), stringToField(registryId)]);
}
