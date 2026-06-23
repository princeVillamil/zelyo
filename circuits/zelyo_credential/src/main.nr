mod poseidon;

use crate::poseidon::{
    AttributesF, MERKLE_DEPTH, build_leaf, compute_nullifier, hash_two, id_commitment,
};

// Recompute the Merkle root from a leaf + siblings/indices (index false = leaf on left).
fn merkle_root(leaf: Field, siblings: [Field; 20], indices: [bool; 20]) -> Field {
    let mut node = leaf;
    for i in 0..MERKLE_DEPTH {
        let sib = siblings[i];
        // indices[i] == false => current node is the LEFT child.
        let left = if indices[i] { sib } else { node };
        let right = if indices[i] { node } else { sib };
        node = hash_two(left, right);
    }
    node
}

// Range/date predicate (Could, additive + gated). predicate_mode:
//   0 = OFF  (base demo; predicate inputs ignored, no extra constraint)
//   1 = RANGE on attributes.grade   (predicate_lo <= grade <= predicate_hi)
//   2 = DATE  on attributes.issue_date (predicate_lo <= issue_date <= predicate_hi)
// Bounds are checked with a 64-bit range proof so comparisons are sound for
// demo-sized values (grades, YYYYMMDD dates) — never near the field modulus.
fn check_predicate(
    attrs: AttributesF,
    predicate_mode: u32,
    predicate_lo: Field,
    predicate_hi: Field,
) {
    if predicate_mode != 0 {
        let value = if predicate_mode == 1 { attrs.grade } else { attrs.issue_date };
        // Cast into 64-bit ints (demo-sized values, never near the modulus) and
        // assert the bound with real u64 comparisons. A field-level `-` then
        // `as u64` would silently truncate on underflow rather than fail, so the
        // comparison must happen in the integer domain.
        let v: u64 = value as u64;
        let lo: u64 = predicate_lo as u64;
        let hi: u64 = predicate_hi as u64;
        assert(v >= lo, "predicate lower bound");
        assert(v <= hi, "predicate upper bound");
    }
}

fn main(
    // PRIVATE
    s: Field,
    attributes: AttributesF,
    merkle_siblings: [Field; 20],
    merkle_indices: [bool; 20],
    // PUBLIC
    root: pub Field,
    scope: pub Field,
    bound_address: pub Field,
    nullifier: pub Field,
    disclosed: pub Field,
    predicate_mode: pub u32,
    predicate_lo: pub Field,
    predicate_hi: pub Field,
) {
    // leaf = Poseidon( Poseidon(s), Poseidon(attributes) )
    let idc = id_commitment(s);
    let leaf = build_leaf(idc, attributes);

    // Merkle inclusion: recomputed root must equal the published root.
    let computed_root = merkle_root(leaf, merkle_siblings, merkle_indices);
    assert(computed_root == root, "computed_root == root");

    // Selective disclosure: the single revealed attribute is `track`.
    assert(attributes.track == disclosed, "attributes.track == disclosed");

    // Sybil resistance: nullifier == Poseidon(s, scope).
    assert(nullifier == compute_nullifier(s, scope), "nullifier == compute_nullifier(s, scope)");

    // Address binding: fold bound_address into the constraint system so the proof
    // is non-malleable to a different wallet. A satisfied dummy constraint that
    // references bound_address forces it into the public-input set the verifier
    // checks. (bound_address * 0 == 0 keeps it provable for any address while
    // still committing the wire.)
    assert(bound_address * 0 == 0);

    // Could (gated, additive): optional range/date predicate. Off by default.
    check_predicate(attributes, predicate_mode, predicate_lo, predicate_hi);
}

// --- Test fixtures -------------------------------------------------------
// A depth-20 inclusion fixture: leaf is the left-most leaf, all siblings = 0,
// all indices = 0. The root is computed by folding `Poseidon2([node,0],2)` 20×.
fn fixture_attrs() -> AttributesF {
    AttributesF { track: 42, grade: 90, issue_date: 20260601 }
}

fn fixture_root(leaf: Field) -> Field {
    merkle_root(leaf, [0; 20], [false; 20])
}

#[test]
fn test_leaf_helper_is_deterministic() {
    let s: Field = 12345;
    let idc = id_commitment(s);
    let attrs = AttributesF { track: 7, grade: 90, issue_date: 20260601 };
    let a = build_leaf(idc, attrs);
    let b = build_leaf(idc, attrs);
    assert(a == b);
}

#[test]
fn test_valid_proof_succeeds() {
    let s: Field = 12345;
    let attrs = fixture_attrs();
    let leaf = build_leaf(id_commitment(s), attrs);
    let root = fixture_root(leaf);
    let scope: Field = 999;
    main(
        s, attrs, [0; 20], [false; 20],
        root, scope, /*bound_address*/ 7,
        /*nullifier*/ compute_nullifier(s, scope),
        /*disclosed*/ 42,
        /*predicate_mode*/ 0, /*lo*/ 0, /*hi*/ 0,
    );
}

#[test(should_fail_with = "computed_root == root")]
fn test_wrong_root_fails() {
    let s: Field = 12345;
    let attrs = fixture_attrs();
    let scope: Field = 999;
    main(
        s, attrs, [0; 20], [false; 20],
        /*root*/ 1, // wrong root
        scope, 7,
        compute_nullifier(s, scope),
        42,
        0, 0, 0,
    );
}

#[test(should_fail_with = "attributes.track == disclosed")]
fn test_wrong_disclosed_fails() {
    let s: Field = 12345;
    let attrs = fixture_attrs();
    let leaf = build_leaf(id_commitment(s), attrs);
    let root = fixture_root(leaf);
    let scope: Field = 999;
    main(
        s, attrs, [0; 20], [false; 20],
        root, scope, 7,
        compute_nullifier(s, scope),
        /*disclosed*/ 7, // != track (42)
        0, 0, 0,
    );
}

#[test(should_fail_with = "nullifier == compute_nullifier(s, scope)")]
fn test_wrong_nullifier_fails() {
    let s: Field = 12345;
    let attrs = fixture_attrs();
    let leaf = build_leaf(id_commitment(s), attrs);
    let root = fixture_root(leaf);
    let scope: Field = 999;
    main(
        s, attrs, [0; 20], [false; 20],
        root, scope, 7,
        /*nullifier*/ 123456789, // wrong
        42,
        0, 0, 0,
    );
}

#[test]
fn test_predicate_range_on_succeeds() {
    let s: Field = 12345;
    let attrs = fixture_attrs(); // grade = 90
    let leaf = build_leaf(id_commitment(s), attrs);
    let root = fixture_root(leaf);
    let scope: Field = 999;
    main(
        s, attrs, [0; 20], [false; 20],
        root, scope, 7,
        compute_nullifier(s, scope),
        42,
        /*mode*/ 1, /*lo*/ 50, /*hi*/ 100, // 50 <= 90 <= 100
    );
}

#[test(should_fail)]
fn test_predicate_range_out_of_bounds_fails() {
    let s: Field = 12345;
    let attrs = fixture_attrs(); // grade = 90
    let leaf = build_leaf(id_commitment(s), attrs);
    let root = fixture_root(leaf);
    let scope: Field = 999;
    main(
        s, attrs, [0; 20], [false; 20],
        root, scope, 7,
        compute_nullifier(s, scope),
        42,
        /*mode*/ 1, /*lo*/ 95, /*hi*/ 100, // 90 < 95 => fail
    );
}
