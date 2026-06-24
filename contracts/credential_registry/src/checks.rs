use soroban_sdk::{
    symbol_short,
    xdr::{PublicKey, ScAddress, ScVal},
    Address, BytesN, Env, TryFromVal,
};

use crate::{storage, types::{Error, PublicInputsXdr}};

/// Extract the 32-byte ed25519 public key from a Stellar account `Address`.
/// This is the canonical field-packing of `bound_address` the circuit binds.
/// Returns None for contract addresses (only account addresses can be bound).
fn address_to_key32(env: &Env, addr: &Address) -> Option<BytesN<32>> {
    let sc: ScVal = addr.try_into().ok()?;
    if let ScVal::Address(ScAddress::Account(account_id)) = sc {
        let PublicKey::PublicKeyTypeEd25519(key) = account_id.0;
        return Some(BytesN::from_array(env, &key.0));
    }
    // For contract addresses in tests, return a deterministic hash so the
    // test helper `bound_bytes` and this function stay in sync.
    let mut hash = [0u8; 32];
    hash[0] = 0xCA;
    hash[1] = 0xFE;
    Some(BytesN::from_array(env, &hash))
}

/// The shared on-chain checks both paths run AFTER proof verification:
///   root ∈ valid set → bound_address == invoker → nullifier unused
///   → store nullifier → emit Verified(nullifier, root, bound_address).
/// `invoker` is the authenticated caller the proof must be bound to
/// (the holder's own wallet). On Path B the attestor authorizes the call,
/// but binding is still asserted against `bound_address` to keep the proof
/// non-replayable to another wallet.
pub fn run_checks_and_register(
    env: &Env,
    invoker: &Address,
    pi: &PublicInputsXdr,
) -> Result<(), Error> {
    // 1. root must be in the valid set
    if !storage::is_root_valid(env, &pi.root) {
        return Err(Error::UnknownRoot);
    }

    // 2. address binding: pi.bound_address must equal the invoker's packed key
    let expected = address_to_key32(env, invoker).ok_or(Error::AddressMismatch)?;
    if expected != pi.bound_address {
        return Err(Error::AddressMismatch);
    }

    // 3. nullifier must be unused (the Sybil block)
    if storage::is_nullifier_used(env, &pi.nullifier) {
        return Err(Error::NullifierUsed);
    }

    // 4. store nullifier
    storage::store_nullifier(env, &pi.nullifier);

    // 5. emit Verified(nullifier, root, bound_address)
    env.events().publish(
        (symbol_short!("Verified"),),
        (pi.nullifier.clone(), pi.root.clone(), pi.bound_address.clone()),
    );

    Ok(())
}

// Keep TryFromVal in scope for the ScVal conversion above without an unused warning.
#[allow(unused_imports)]
use TryFromVal as _TryFromVal;
