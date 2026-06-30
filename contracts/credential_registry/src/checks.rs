use soroban_sdk::{
    address_payload::AddressPayload,
    symbol_short,
    Address, Bytes, BytesN, Env, U256,
};

use crate::{storage, types::{Error, PublicInputsXdr}};

/// BN254 scalar field modulus (little-endian constants are awkward in no_std,
/// so we express it as a fixed 32-byte big-endian array). This MUST stay byte-
/// identical to `BN254_MODULUS` in `packages/zk-shared/src/field.ts`.
const BN254_MODULUS_BE: [u8; 32] = [
    0x30, 0x64, 0x4e, 0x72, 0xe1, 0x31, 0xa0, 0x29,
    0xb8, 0x50, 0x45, 0xb6, 0x81, 0x81, 0x58, 0x5d,
    0x28, 0x33, 0xe8, 0x48, 0x79, 0xb9, 0x70, 0x91,
    0x43, 0xe1, 0xf5, 0x93, 0xf0, 0x00, 0x00, 0x01,
];

/// Extract the 32-byte payload from a Stellar `Address`.
/// For account addresses (G...) this is the ed25519 public key — the canonical
/// raw key the circuit's `bound_address` is derived from.
/// For contract addresses (C...) this is the 32-byte contract hash.
/// Returns None only if the address type is unrecognized.
fn address_to_key32(_env: &Env, addr: &Address) -> Option<BytesN<32>> {
    match addr.to_payload()? {
        AddressPayload::AccountIdPublicKeyEd25519(key) => Some(key),
        AddressPayload::ContractIdHash(hash) => Some(hash),
    }
}

/// Field-pack an address the same way the Noir circuit and JS prover do:
/// take the raw 32-byte key as an unsigned big-endian integer and reduce it
/// modulo the BN254 scalar field. This collapses the ~1-in-2 chance of an
/// `AddressMismatch` for ed25519 keys whose top bits exceed the field prime.
fn address_to_field32(env: &Env, addr: &Address) -> Option<BytesN<32>> {
    let key = address_to_key32(env, addr)?;
    // BytesN<32> -> Bytes so U256 can parse it as a big-endian uint256.
    let key_bytes: Bytes = key.into();
    let key_u256 = U256::from_be_bytes(env, &key_bytes);
    let modulus = U256::from_be_bytes(env, &Bytes::from_array(env, &BN254_MODULUS_BE));
    let reduced = key_u256.rem_euclid(&modulus);
    let reduced_bytes = reduced.to_be_bytes();
    Some(BytesN::try_from(reduced_bytes).unwrap_or_else(|_| BytesN::from_array(env, &[0u8; 32])))
}

/// The shared on-chain checks both paths run AFTER proof verification:
///   root ∈ valid set → bound_address == invoker (field-packed) → nullifier unused
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

    // 2. address binding: pi.bound_address must equal the field-packed invoker key
    let expected = address_to_field32(env, invoker).ok_or(Error::AddressMismatch)?;
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
