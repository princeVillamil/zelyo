use soroban_sdk::{
    address_payload::AddressPayload,
    symbol_short,
    Address, BytesN, Env,
};

use crate::{storage, types::{Error, PublicInputsXdr}};

/// Extract the 32-byte payload from a Stellar `Address`.
/// For account addresses (G...) this is the ed25519 public key — the canonical
/// field-packing of `bound_address` the circuit binds.
/// For contract addresses (C...) this is the 32-byte contract hash.
/// Returns None only if the address type is unrecognized.
fn address_to_key32(_env: &Env, addr: &Address) -> Option<BytesN<32>> {
    match addr.to_payload()? {
        AddressPayload::AccountIdPublicKeyEd25519(key) => Some(key),
        AddressPayload::ContractIdHash(hash) => Some(hash),
    }
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
