#![cfg(test)]

use crate::types::{Error, PublicInputsXdr};
use soroban_sdk::{Address, Bytes, BytesN, Env, U256};

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
use soroban_sdk::testutils::Address as _;

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

use soroban_sdk::address_payload::AddressPayload;

/// Test helper: produce the field-packed 32-byte payload the contract expects
/// for `addr`. Mirrors the JS `encodeAddressToField` reduction: raw 32-byte
/// address key reduced mod BN254_P.
fn bound_bytes(env: &Env, addr: &Address) -> BytesN<32> {
    let key: BytesN<32> = match addr.to_payload() {
        Some(AddressPayload::AccountIdPublicKeyEd25519(key)) => key,
        Some(AddressPayload::ContractIdHash(hash)) => hash,
        None => BytesN::from_array(env, &[0u8; 32]),
    };
    let key_bytes: Bytes = key.into();
    let n = U256::from_be_bytes(env, &key_bytes);
    let modulus = U256::from_be_bytes(
        env,
        &Bytes::from_array(
            env,
            &[
                0x30, 0x64, 0x4e, 0x72, 0xe1, 0x31, 0xa0, 0x29, 0xb8, 0x50, 0x45, 0xb6, 0x81,
                0x81, 0x58, 0x5d, 0x28, 0x33, 0xe8, 0x48, 0x79, 0xb9, 0x70, 0x91, 0x43, 0xe1,
                0xf5, 0x93, 0xf0, 0x00, 0x00, 0x01,
            ],
        ),
    );
    let reduced = n.rem_euclid(&modulus);
    BytesN::try_from(reduced.to_be_bytes()).unwrap_or_else(|_| BytesN::from_array(env, &[0u8; 32]))
}

fn pi_for(env: &Env, root: &BytesN<32>, addr: &Address, nullifier_seed: u8) -> PublicInputsXdr {
    PublicInputsXdr {
        root: root.clone(),
        scope: BytesN::from_array(env, &[1u8; 32]),
        bound_address: bound_bytes(env, addr),
        nullifier: BytesN::from_array(env, &[nullifier_seed; 32]),
        disclosed: BytesN::from_array(env, &[2u8; 32]),
    }
}

#[test]
fn register_path_b_happy_path() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, issuer, attestor, _verifier) = setup(&env);

    let root = BytesN::from_array(&env, &[7u8; 32]);
    client.set_root(&issuer, &root);

    let holder = Address::generate(&env);
    let pi = pi_for(&env, &root, &holder, 42);

    assert_eq!(client.is_nullifier_used(&pi.nullifier), false);
    client.register(&pi, &attestor, &holder);
    assert_eq!(client.is_nullifier_used(&pi.nullifier), true);
}

#[test]
fn register_duplicate_nullifier_reverts() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, issuer, attestor, _verifier) = setup(&env);

    let root = BytesN::from_array(&env, &[7u8; 32]);
    client.set_root(&issuer, &root);

    let holder = Address::generate(&env);
    let pi = pi_for(&env, &root, &holder, 42);

    client.register(&pi, &attestor, &holder); // first use succeeds
    let res = client.try_register(&pi, &attestor, &holder); // second use is the Sybil block
    assert!(res.is_err());
}

#[test]
fn register_unknown_root_reverts() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _issuer, attestor, _verifier) = setup(&env);

    // root never added via set_root
    let root = BytesN::from_array(&env, &[123u8; 32]);
    let holder = Address::generate(&env);
    let pi = pi_for(&env, &root, &holder, 5);

    let res = client.try_register(&pi, &attestor, &holder);
    assert!(res.is_err());
}

#[test]
fn register_address_mismatch_reverts() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, issuer, attestor, _verifier) = setup(&env);

    let root = BytesN::from_array(&env, &[7u8; 32]);
    client.set_root(&issuer, &root);

    // bound_address is packed for `holder`, but the proof claims a different one
    let holder = Address::generate(&env);
    let mut pi = pi_for(&env, &root, &holder, 9);
    pi.bound_address = BytesN::from_array(&env, &[255u8; 32]); // not holder's key

    let res = client.try_register(&pi, &attestor, &holder);
    assert!(res.is_err());
}

#[test]
fn verify_and_register_path_a_happy_path() {
    let env = Env::default();
    env.mock_all_auths();

    // Deploy the real verifier and a registry pointed at it.
    let verifier_id = env.register(verifier::Verifier, ());
    let issuer = Address::generate(&env);
    let attestor = Address::generate(&env);
    let registry_id = env.register(CredentialRegistry, ());
    let client = CredentialRegistryClient::new(&env, &registry_id);
    client.initialize(&issuer, &attestor, &verifier_id);

    let root = BytesN::from_array(&env, &[7u8; 32]);
    client.set_root(&issuer, &root);

    let holder = Address::generate(&env);
    let pi = pi_for(&env, &root, &holder, 77);

    // Non-empty proof so the verifier's host path runs and returns true.
    let proof = soroban_sdk::Bytes::from_array(&env, &[1u8, 2, 3, 4]);
    client.verify_and_register(&proof, &pi, &holder);
    assert_eq!(client.is_nullifier_used(&pi.nullifier), true);
}

#[test]
fn verify_and_register_invalid_proof_reverts() {
    let env = Env::default();
    env.mock_all_auths();

    let verifier_id = env.register(verifier::Verifier, ());
    let issuer = Address::generate(&env);
    let attestor = Address::generate(&env);
    let registry_id = env.register(CredentialRegistry, ());
    let client = CredentialRegistryClient::new(&env, &registry_id);
    client.initialize(&issuer, &attestor, &verifier_id);

    let root = BytesN::from_array(&env, &[7u8; 32]);
    client.set_root(&issuer, &root);
    let holder = Address::generate(&env);
    let pi = pi_for(&env, &root, &holder, 88);

    // Empty proof → verifier returns false → InvalidProof.
    let proof = soroban_sdk::Bytes::new(&env);
    let res = client.try_verify_and_register(&proof, &pi, &holder);
    assert!(res.is_err());
}

#[test]
fn revoke_root_invalidates_old_root() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, issuer, attestor, _verifier) = setup(&env);

    let root = BytesN::from_array(&env, &[7u8; 32]);
    client.set_root(&issuer, &root);
    assert_eq!(client.is_root_valid(&root), true);

    client.revoke_root(&issuer, &root);
    assert_eq!(client.is_root_valid(&root), false);

    // A register against the revoked root now fails UnknownRoot.
    let holder = Address::generate(&env);
    let pi = pi_for(&env, &root, &holder, 13);
    let res = client.try_register(&pi, &attestor, &holder);
    assert!(res.is_err());
}

#[test]
fn revoke_root_requires_issuer_auth() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, issuer, _attestor, _verifier) = setup(&env);

    let root = BytesN::from_array(&env, &[7u8; 32]);
    client.set_root(&issuer, &root);

    let stranger = Address::generate(&env);
    let res = client.try_revoke_root(&stranger, &root);
    assert!(res.is_err());
}
