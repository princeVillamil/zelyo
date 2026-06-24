#![cfg(test)]

use crate::{Verifier, VerifierClient};
use soroban_sdk::{Bytes, Env};

#[test]
fn verify_returns_bool() {
    let env = Env::default();
    let contract_id = env.register(Verifier, ());
    let client = VerifierClient::new(&env, &contract_id);

    // With an empty proof, verify must return false (not panic).
    let empty = Bytes::new(&env);
    assert_eq!(client.verify(&empty, &empty), false);
}
