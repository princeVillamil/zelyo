use poseidon::poseidon2::Poseidon2;

pub global MERKLE_DEPTH: u32 = 20;

// Attribute field-packing used by both the circuit and the JS parity builders.
// Only `track`, `grade`, `issue_date` are folded into the credential hash for the
// demo; courseName/learnerName stay off-circuit (held only off-chain in Postgres).
pub struct AttributesF {
    pub track: Field,
    pub grade: Field,
    pub issue_date: Field,
}

// Poseidon(track, grade, issue_date)
pub fn hash_attributes(attrs: AttributesF) -> Field {
    Poseidon2::hash([attrs.track, attrs.grade, attrs.issue_date], 3)
}

// leaf = Poseidon( Poseidon(s), Poseidon(attributes) )
// `id_commitment` is already Poseidon(s); the holder passes it in.
pub fn build_leaf(id_commitment: Field, attrs: AttributesF) -> Field {
    let attr_hash = hash_attributes(attrs);
    Poseidon2::hash([id_commitment, attr_hash], 2)
}

// id_commitment = Poseidon(s)
pub fn id_commitment(s: Field) -> Field {
    Poseidon2::hash([s], 1)
}

// nullifier = Poseidon(s, scope)
pub fn compute_nullifier(s: Field, scope: Field) -> Field {
    Poseidon2::hash([s, scope], 2)
}

// Two-input Poseidon, used for Merkle node hashing. Lives here so `main` (which
// declares `mod poseidon`, shadowing the external `poseidon` crate name) does not
// need to import `Poseidon2` directly.
pub fn hash_two(left: Field, right: Field) -> Field {
    Poseidon2::hash([left, right], 2)
}
