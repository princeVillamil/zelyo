#![no_std]

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
}
