// Phase 1 production circuit. Proves Merkle inclusion of a credential leaf
// derived from the holder secret `s` and the credential attributes, outputs a
// scope-bound nullifier, opens exactly one attribute (`track`) via `disclosed`,
// and binds the proof to a public Stellar address.
//
// Hashing is Poseidon2 throughout (see poseidon.nr) so it matches the JS
// builders in @zelyo/zk-shared — parity is frozen by the parity-vectors fixture
// and asserted by packages/zk-shared/test/parity.test.ts.

mod poseidon;

use poseidon::{
    build_leaf, compute_nullifier, hash_one, hash_two, id_commitment, AttributesF,
};

// Production tree depth. MUST equal MERKLE_DEPTH in @zelyo/zk-shared and the
// @zk-kit/imt tree built by merkle.service.ts.
global MERKLE_DEPTH: u32 = 20;

fn main(
    s: Field,                                   // private: holder secret
    attributes: AttributesF,                    // private: track/grade/issue_date fields
    merkle_path: [Field; MERKLE_DEPTH],         // private: sibling hashes, leaf -> root
    path_indices: [bool; MERKLE_DEPTH],         // private: false = node is left child, true = right
    root: pub Field,                            // public: published Merkle root
    scope: pub Field,                           // public: Hash(app_id|chain_id|registry_id)
    bound_address: pub Field,                   // public: field-packed Stellar pubkey
    nullifier: pub Field,                       // public: asserted == Poseidon(s, scope)
    disclosed: pub Field,                       // public: asserted == Poseidon(track)
) {
    // Reconstruct the leaf from the private secret + attributes:
    //   leaf = Poseidon( Poseidon(s), Poseidon(track, grade, issue_date) )
    let idc = id_commitment(s);
    let mut node = build_leaf(idc, attributes);

    // Walk the Merkle path up to the published root.
    for i in 0..MERKLE_DEPTH {
        let sibling = merkle_path[i];
        let is_right = path_indices[i] as Field;
        // is_right == 0: node is the left child; else node is the right child.
        let left = node * (1 - is_right) + sibling * is_right;
        let right = sibling * (1 - is_right) + node * is_right;
        node = hash_two(left, right);
    }
    assert(node == root);

    // Nullifier binds (s, scope): one registration per holder per scope.
    assert(nullifier == compute_nullifier(s, scope));

    // Selective disclosure: the public `disclosed` must be the hash of the real
    // `track` attribute committed in the leaf. Grade/issue_date stay hidden.
    assert(disclosed == hash_one(attributes.track));

    // Address binding: a non-zero public address ties this proof to a specific
    // recipient. The proof only verifies when presented with this exact address.
    assert(bound_address != 0);
}

// Prints the golden field values consumed by circuits/export-vectors.sh, which
// freezes them into the JS parity fixture. Values mirror the existing fixture.
#[test]
fn print_parity_vectors() {
    let s: Field = 0x3039;
    let scope: Field = 0x03e7;
    let attrs = AttributesF { track: 0x2a, grade: 0x5a, issue_date: 0x013526f9 };

    let idc = id_commitment(s);
    let attr_hash = poseidon::hash_attributes(attrs);
    let leaf = build_leaf(idc, attrs);
    let nullifier = compute_nullifier(s, scope);

    let track = attrs.track;
    let grade = attrs.grade;
    let issue_date = attrs.issue_date;
    println(f"s={s}");
    println(f"scope={scope}");
    println(f"track={track}");
    println(f"grade={grade}");
    println(f"issue_date={issue_date}");
    println(f"idCommitment={idc}");
    println(f"attrHash={attr_hash}");
    println(f"leaf={leaf}");
    println(f"nullifier={nullifier}");
}
