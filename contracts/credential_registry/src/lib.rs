#![no_std]

mod checks;
mod storage;
mod types;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, panic_with_error, Address, BytesN, Env};

pub use types::{Error, PublicInputsXdr};

#[contract]
pub struct CredentialRegistry;

#[contractimpl]
impl CredentialRegistry {
    /// One-time setup: records the issuer (may publish/revoke roots), the
    /// attestor (may call `register` on Path B), and the verifier contract
    /// (called on Path A). Panics if already initialized.
    pub fn initialize(env: Env, issuer: Address, attestor: Address, verifier: Address) {
        if storage::is_initialized(&env) {
            panic_with_error!(&env, Error::NotAuthorized);
        }
        storage::set_roles(&env, &issuer, &attestor, &verifier);
    }

    /// Issuer-only. Appends `root` to the valid root set.
    pub fn set_root(env: Env, issuer: Address, root: BytesN<32>) {
        if let Err(e) = storage::require_issuer(&env, &issuer) {
            panic_with_error!(&env, e);
        }
        storage::add_root(&env, &root);
    }

    pub fn is_root_valid(env: Env, root: BytesN<32>) -> bool {
        storage::is_root_valid(&env, &root)
    }

    /// Path B (ZK_VERIFY_MODE = "server"). The off-chain server has already
    /// verified the proof (bb.js / nargo verify). The attestor authorizes this
    /// call; the contract still enforces root validity, address binding, and
    /// nullifier uniqueness on-chain. `holder` is the wallet the proof is
    /// bound to; the contract asserts `pi.bound_address` matches the holder's
    /// packed ed25519 key.
    pub fn register(env: Env, pi: PublicInputsXdr, attestor: Address, holder: Address) {
        // attestor must sign AND be the configured attestor
        attestor.require_auth();
        if attestor != storage::attestor(&env) {
            panic_with_error!(&env, Error::NotAuthorized);
        }

        // The holder address is passed by the attestor (server guarantees it).
        // run_checks_and_register asserts pi.bound_address == holder's key.
        if let Err(e) = checks::run_checks_and_register(&env, &holder, &pi) {
            panic_with_error!(&env, e);
        }
    }

    pub fn is_nullifier_used(env: Env, nullifier: BytesN<32>) -> bool {
        storage::is_nullifier_used(&env, &nullifier)
    }

    /// Path A (ZK_VERIFY_MODE = "onchain"). Verifies the proof on-chain via the
    /// configured verifier contract, then runs the shared checks. The holder's
    /// own wallet invokes this; binding is asserted against the invoker.
    pub fn verify_and_register(env: Env, proof: soroban_sdk::Bytes, pi: PublicInputsXdr, holder: Address) {
        // 1. Encode the public inputs the verifier expects (root|scope|
        //    bound_address|nullifier|disclosed, each 32 bytes, in order).
        let mut public_inputs = soroban_sdk::Bytes::new(&env);
        public_inputs.append(&soroban_sdk::Bytes::from(pi.root.clone()));
        public_inputs.append(&soroban_sdk::Bytes::from(pi.scope.clone()));
        public_inputs.append(&soroban_sdk::Bytes::from(pi.bound_address.clone()));
        public_inputs.append(&soroban_sdk::Bytes::from(pi.nullifier.clone()));
        public_inputs.append(&soroban_sdk::Bytes::from(pi.disclosed.clone()));

        // 2. Verify on-chain via the reused verifier contract.
        let verifier_id = storage::verifier(&env);
        let verifier = verifier::VerifierClient::new(&env, &verifier_id);
        if !verifier.verify(&proof, &public_inputs) {
            panic_with_error!(&env, Error::InvalidProof);
        }

        // 3. The holder invokes Path A directly; require_auth ensures they signed.
        holder.require_auth();

        // 4. Shared checks: root valid → binding → nullifier unused → store →
        //    emit Verified.
        if let Err(e) = checks::run_checks_and_register(&env, &holder, &pi) {
            panic_with_error!(&env, e);
        }
    }

    /// Could (SPEC §1): issuer revokes a root. Proofs against it then fail
    /// UnknownRoot — revocation by root rotation.
    pub fn revoke_root(env: Env, issuer: Address, root: BytesN<32>) {
        if let Err(e) = storage::require_issuer(&env, &issuer) {
            panic_with_error!(&env, e);
        }
        storage::remove_root(&env, &root);
    }
}
