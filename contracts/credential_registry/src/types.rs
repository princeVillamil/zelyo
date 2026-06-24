use soroban_sdk::{contracterror, contracttype, BytesN};

/// Contract error codes. Discriminants are part of the cross-phase contract
/// (see the index plan) — the TS layer maps them to VerificationResult.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotAuthorized = 1,
    UnknownRoot = 2,
    NullifierUsed = 3,
    AddressMismatch = 4,
    InvalidProof = 5,
}

/// On-chain mirror of the TS `PublicInputs` type from `packages/zk-shared`.
/// Every field is a 32-byte field element (BN254). NO personal data here.
///   root          — published Merkle root the proof was made against
///   scope         — Hash(app_id | chain_id | registry_id); binds the nullifier
///   bound_address — Stellar ed25519 pubkey, field-packed; must equal invoker
///   nullifier     — Poseidon(s, scope); the Sybil-block key
///   disclosed     — hash/encoding of the revealed attribute (e.g. track)
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PublicInputsXdr {
    pub root: BytesN<32>,
    pub scope: BytesN<32>,
    pub bound_address: BytesN<32>,
    pub nullifier: BytesN<32>,
    pub disclosed: BytesN<32>,
}
