#![no_std]

mod vk;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, Bytes, Env};

#[contract]
pub struct Verifier;

#[contractimpl]
impl Verifier {
    /// Verify a Noir UltraHonk/Groth16 proof against the embedded verification
    /// key for the given encoded public inputs. Returns true iff the proof is
    /// valid. On Path A this is called cross-contract by CredentialRegistry.
    ///
    /// The proof bytes are decoded and checked against `vk::VERIFICATION_KEY`
    /// using the protocol's reused verifier / BN254 + Poseidon host functions
    /// (Protocol "X-Ray", per SPEC §3). If the running protocol does not expose
    /// the pairing/Poseidon host fns, Phase 0's spike selects Path B and this
    /// contract is not used at runtime — but it still compiles.
    pub fn verify(env: Env, proof: Bytes, public_inputs: Bytes) -> bool {
        // Defensive: empty proof or empty public inputs can never verify.
        if proof.is_empty() || public_inputs.is_empty() {
            return false;
        }
        // Real verification: call the reused on-chain verifier with the embedded
        // VK. Wire this to the host fn / reused-verifier crate the Phase 0 spike
        // validated. The VK is available as `vk::VERIFICATION_KEY`.
        verify_with_host(&env, &proof, &public_inputs, vk::VERIFICATION_KEY)
    }
}

/// Bridge to the protocol's reused verifier. Phase 0's spike determined that the
/// current Soroban testnet (protocol 27) does not expose BN254 pairing or Poseidon
/// host functions capable of verifying an UltraHonk proof. Until those primitives
/// are available, this contract returns `false` for any non-empty proof so that
/// `CredentialRegistry.verify_and_register` reverts with `InvalidProof`. The API is
/// preserved so Path A can be enabled without registry changes once the protocol
/// supports real on-chain verification.
fn verify_with_host(_env: &Env, _proof: &Bytes, _public_inputs: &Bytes, _vk: &[u8]) -> bool {
    // Path A is intentionally disabled. See docs/superpowers/decisions/zk-verify-mode.md.
    false
}
