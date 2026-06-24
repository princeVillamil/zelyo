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
}
