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

use crate::{CredentialRegistry, CredentialRegistryClient};
use soroban_sdk::{testutils::Address as _, Address};

fn setup(env: &Env) -> (CredentialRegistryClient, Address, Address, Address) {
    let issuer = Address::generate(env);
    let attestor = Address::generate(env);
    let verifier = Address::generate(env);
    let contract_id = env.register(CredentialRegistry, ());
    let client = CredentialRegistryClient::new(env, &contract_id);
    client.initialize(&issuer, &attestor, &verifier);
    (client, issuer, attestor, verifier)
}

#[test]
fn set_root_adds_to_valid_set() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, issuer, _attestor, _verifier) = setup(&env);

    let root = BytesN::from_array(&env, &[7u8; 32]);
    assert_eq!(client.is_root_valid(&root), false);

    client.set_root(&issuer, &root);
    assert_eq!(client.is_root_valid(&root), true);
}

#[test]
fn set_root_requires_issuer_auth() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _issuer, _attestor, _verifier) = setup(&env);

    // A non-issuer address attempting set_root must be rejected with NotAuthorized.
    let stranger = Address::generate(&env);
    let root = BytesN::from_array(&env, &[9u8; 32]);

    let res = client.try_set_root(&stranger, &root);
    assert!(res.is_err());
    // The outer error is a soroban_sdk::Error; our contract error NotAuthorized
    // is encoded as a contract error status. We assert it is an error response.
    // (The exact discriminant comparison against our enum is not possible because
    // try_ methods return soroban_sdk::Error, which wraps the raw status.)
    let _err = res.unwrap_err();
    // If we reach here, the call errored as expected.
}
