// Phase 0 spike circuit. Proves Merkle inclusion of a leaf derived from the
// holder secret `s`, and outputs nullifier = Poseidon([s, scope]).
// NO selective disclosure, NO address binding — those land in Phase 1.
// Fixed depth 4 keeps the spike fast; the production circuit uses depth 20.

use ::poseidon::poseidon::bn254;

global SPIKE_DEPTH: u32 = 4;

fn main(
    s: Field,                                   // private: holder secret
    merkle_path: [Field; SPIKE_DEPTH],          // private: sibling hashes
    path_indices: [bool; SPIKE_DEPTH],          // private: false = current is left, true = right
    root: pub Field,                            // public: published Merkle root
    scope: pub Field,                           // public: Hash(app_id|chain_id|registry_id)
    nullifier: pub Field,                       // public: output, asserted below
) {
    // leaf = Poseidon(Poseidon(s)) for the spike (single attribute slot omitted)
    let id_commitment = bn254::hash_1([s]);
    let mut node = bn254::hash_1([id_commitment]);

    for i in 0..SPIKE_DEPTH {
        let sibling = merkle_path[i];
        let is_right = path_indices[i] as Field;
        // if is_right == 0: node is left child; else node is right child
        let left = node * (1 - is_right) + sibling * is_right;
        let right = sibling * (1 - is_right) + node * is_right;
        node = bn254::hash_2([left, right]);
    }

    assert(node == root);
    assert(nullifier == bn254::hash_2([s, scope]));
}
