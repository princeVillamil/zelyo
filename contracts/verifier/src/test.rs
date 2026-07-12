#![cfg(test)]

use crate::{Verifier, VerifierClient};
use soroban_sdk::{Bytes, Env};

#[test]
fn verify_returns_bool() {
    let env = Env::default();
    let contract_id = env.register(Verifier, ());
    let client = VerifierClient::new(&env, &contract_id);

    // Path A is disabled on the current testnet (no BN254/Poseidon host fns),
    // so the verifier returns false for all inputs without panicking.
    let empty = Bytes::new(&env);
    assert_eq!(client.verify(&empty, &empty), false);
}
