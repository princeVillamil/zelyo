# Decision: ZK_VERIFY_MODE (Path A vs Path B)

**Date:** 2026-06-24
**Phase:** 0 — Foundation & ZK feasibility spike
**Decision driver:** design doc §2 (the central risk and its fallback).

## Outcome

`ZK_VERIFY_MODE = server`

## Evidence (from `spike/README.md`)

| Step | Result |
|------|--------|
| `nargo compile` | ✅ Succeeded with noir-lang/poseidon v0.3.0 (std Poseidon API changed in beta.22). |
| bb.js local `verifyProof` | ✅ `true` — UltraHonk proof generation and local verification work. |
| `spike_verifier` build | ✅ Succeeded with Rust 1.92.0 / `wasm32v1-none` / soroban-sdk 26.1.0. |
| testnet deploy | ✅ Contract ID `CCAEQ2HMODDII6UIPSFKEOZ7WWM3Z3NOYBISZZ4S57WVGOOYY3CGPFPP`. |
| on-chain `verify(valid proof)` | ❌ Returned `false`; Soroban testnet (protocol 27) exposes no BN254 pairing or Poseidon host function capable of verifying an UltraHonk proof. |
| tx hash | `e60fba5531eb96a50c0368c56e91aa024fe4a7abe937e413ae35c00b494f3aa9` |

## Reasoning

Path A (`onchain`) requires a Soroban contract to verify an UltraHonk proof
on-chain. The spike contract built and deployed, but the verification body has
no host primitive to call. `env.crypto()` in soroban-sdk 26.1.0 provides
ed25519/secp256k1/sha256/keccak256 operations, not BN254 pairing or Poseidon
hashes. Without those primitives, the pairing check inside an UltraHonk verifier
cannot be performed inside a contract.

The contract returning `false` is therefore the correct outcome for a valid
proof: the protocol cannot verify it on-chain today.

## Consequence

- Path B is selected: the server verifies the UltraHonk proof via bb.js (or
  `nargo verify`) before any on-chain write.
- `CredentialRegistry.register` records the server-attested nullifier + root
  on-chain (Phase 2/5); the contract does not run the proof verification itself.
- All `SPEC.md §13` acceptance reveals still hold; only the verification
  location changes from on-chain to server-side.
- Phases 4–7 program against the `verifyAndRegister` service interface.
