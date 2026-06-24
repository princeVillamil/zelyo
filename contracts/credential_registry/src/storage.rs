use soroban_sdk::{contracttype, Address, BytesN, Env};

use crate::types::Error;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Issuer,
    Attestor,
    Verifier,
    Root(BytesN<32>),
    Nullifier(BytesN<32>),
}

/// Topic for the persistent-storage entries that must not expire silently.
/// Roles are instance storage; roots and nullifiers are persistent.
pub fn set_roles(env: &Env, issuer: &Address, attestor: &Address, verifier: &Address) {
    let s = env.storage().instance();
    s.set(&DataKey::Issuer, issuer);
    s.set(&DataKey::Attestor, attestor);
    s.set(&DataKey::Verifier, verifier);
}

pub fn issuer(env: &Env) -> Address {
    env.storage()
        .instance()
        .get::<DataKey, Address>(&DataKey::Issuer)
        .expect("not initialized")
}

pub fn attestor(env: &Env) -> Address {
    env.storage()
        .instance()
        .get::<DataKey, Address>(&DataKey::Attestor)
        .expect("not initialized")
}

pub fn verifier(env: &Env) -> Address {
    env.storage()
        .instance()
        .get::<DataKey, Address>(&DataKey::Verifier)
        .expect("not initialized")
}

pub fn is_initialized(env: &Env) -> bool {
    env.storage().instance().has(&DataKey::Issuer)
}

pub fn add_root(env: &Env, root: &BytesN<32>) {
    env.storage().persistent().set(&DataKey::Root(root.clone()), &true);
}

pub fn remove_root(env: &Env, root: &BytesN<32>) {
    env.storage().persistent().remove(&DataKey::Root(root.clone()));
}

pub fn is_root_valid(env: &Env, root: &BytesN<32>) -> bool {
    env.storage()
        .persistent()
        .get::<DataKey, bool>(&DataKey::Root(root.clone()))
        .unwrap_or(false)
}

pub fn is_nullifier_used(env: &Env, nullifier: &BytesN<32>) -> bool {
    env.storage()
        .persistent()
        .has(&DataKey::Nullifier(nullifier.clone()))
}

pub fn store_nullifier(env: &Env, nullifier: &BytesN<32>) {
    env.storage()
        .persistent()
        .set(&DataKey::Nullifier(nullifier.clone()), &true);
}

/// Authorize `caller` as the configured issuer: require its signature AND
/// require it to equal the stored issuer. Returns Err(NotAuthorized) otherwise.
pub fn require_issuer(env: &Env, caller: &Address) -> Result<(), Error> {
    caller.require_auth();
    if *caller != issuer(env) {
        return Err(Error::NotAuthorized);
    }
    Ok(())
}
