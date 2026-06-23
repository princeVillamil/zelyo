mod poseidon;

use crate::poseidon::{AttributesF, build_leaf, compute_nullifier, id_commitment};

fn main() {}

#[test]
fn test_leaf_helper_is_deterministic() {
    let s: Field = 12345;
    let idc = id_commitment(s);
    let attrs = AttributesF { track: 7, grade: 90, issue_date: 20260601 };
    let a = build_leaf(idc, attrs);
    let b = build_leaf(idc, attrs);
    assert(a == b);
}
