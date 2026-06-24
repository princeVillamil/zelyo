#![cfg(test)]

use crate::types::{Error, PublicInputsXdr};
use soroban_sdk::{BytesN, Env};

#[test]
fn types_construct_and_error_codes_match_index() {
    let env = Env::default();
    let z = BytesN::from_array(&env, &[0u8; 32]);
    let pi = PublicInputsXdr {
        root: z.clone(),
        scope: z.clone(),
        bound_address: z.clone(),
        nullifier: z.clone(),
        disclosed: z.clone(),
    };
    // Field access compiles; PublicInputsXdr carries exactly the five fields.
    assert_eq!(pi.root, z);
    assert_eq!(pi.disclosed, z);

    // Error discriminants must match the index Cross-Phase Interface Contract.
    assert_eq!(Error::NotAuthorized as u32, 1);
    assert_eq!(Error::UnknownRoot as u32, 2);
    assert_eq!(Error::NullifierUsed as u32, 3);
    assert_eq!(Error::AddressMismatch as u32, 4);
    assert_eq!(Error::InvalidProof as u32, 5);
}
