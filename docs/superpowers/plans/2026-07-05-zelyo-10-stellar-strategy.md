# Phase 10 — Stellar Ecosystem Integrations & Business Strategy

> **For agentic workers:** This is a **post-Phase-9 strategic integration plan** derived from research as of June 2026 (GitHub Issue #108). This phase focuses on turning Zelyo's prototype into an enterprise-ready privacy platform integrated with standard Stellar protocols.

**Goal:** Implement the strategic upgrades outlined in issue #108: on-chain verification (Path A) utilizing native Soroban host functions, reusable KYC (SEP-12), passkey smart-wallet bound addresses, and token-gated rewards (SEP-8).

**Prerequisites:** Before implementing Phase 10's strategic integrations, the following incomplete/blocking tasks from previous phases (tracked in [REMAINING_TASKS.md](file:///Users/jeffreyvillamil/Desktop/theblokc/zelyo/docs/REMAINING_TASKS.md)) must be completed to ensure the platform is secure, stable, and testable:
- [x] **Task 9.6 — Bind `credentialId` to the proof:** Currently, the client-supplied `credentialId` is not validated against the proof's commitment. This must be verified server-side/on-chain before launching business-critical integrations like SEP-12 KYC.
- [x] **Task 9.7 — Bind a claim to the gate its proof targeted:** Enforce that a verification is tied to its specific `jobGateId` to prevent users from reusing a proof validated for one gate to claim rewards on another gate.
- [x] **Task 7.7 — Resolve e2e 13.1 timeout on GitHub Actions:** Address the proving timeout bottleneck (CI runner CPU, testnet RPC latency) on branch `fix/reveals-13-1-ci-timeout` so the test suite is reliable.
- [x] **Task 7.1 — Verify production CSP and COOP/COEP headers:** Confirm that cross-origin isolation headers are active on the live Railway deployment so that in-browser multi-threaded WASM proving doesn't fail.
- [x] **Task 4.1 & 4.2 — Fix mint SSE confirmation race and closed controller errors:** Resolve the admin portal minting stream instabilities (e.g., SSE crashes and premature sealed status checks).

**Gate:** Deployed contracts verifying Noir proofs natively on-chain on Stellar Testnet (`ZK_VERIFY_MODE = onchain`); working SEP-12 KYC credential issuance draft; passkey-kit demo; token-gated asset rule verified.

---

## Implementation Status (Initiated 2026-07-05)

- [x] **Phase 10 Prerequisites** — Verified 2026-07-06: Tasks 9.6, 9.7, 4.1/4.2, 7.7, 7.1 are implemented and their targeted unit tests pass. See audit notes below.
- [-] **Task 10.1 — Native On-Chain Verification (Path A)** — Partial / blocked on testnet capabilities. The wiring (`submitVerifyAndRegister`, `verify_and_register`) is in place, and the dishonest verifier stub has been corrected to return `false` for all proofs. `ZK_VERIFY_MODE` is reverted to `server` in `.env`, the Path A registry test now expects `InvalidProof`, and `docs/features.md` has been corrected. Real on-chain UltraHonk verification is not possible on the current Soroban testnet (protocol 27) per the Phase 0 decision record `docs/superpowers/decisions/zk-verify-mode.md`.
- [ ] **Task 10.2 — Reusable-KYC for Anchors (SEP-12)**
- [ ] **Task 10.3 — Passkeys & Gasless Transactions (Launchtube)**
- [ ] **Task 10.4 — Token-Gated Rewards & Asset Controls (SEP-8)**

---

## Global Constraints

Refer to `docs/superpowers/plans/2026-06-23-zelyo-00-index.md` for Global Constraints, including strict TypeScript settings, CSP nonce application, COOP/COEP headers, and privacy rules (never leak holder secret `s` or unselected attributes).

---

## Architecture

This phase implements the native cryptographic capabilities delivered in Stellar's **Protocol 25 ("X-Ray")** and **Protocol 26 ("Yardstick")**. Verification moves from the Next.js API server down to the Soroban smart contract layer using native BN254 and Poseidon host functions.

```
HOLDER (WASM Prover)                 API SERVER / GATEWAY                  SOROBAN REGISTER
  Generate BN254/Poseidon  ────────>   Submit ProofBundle  ───────────────>  verify_and_register()
  UltraHonk proof in-browser           via /api/verify                        ├─ Native BN254 EC pairings
                                                                              ├─ Native Poseidon hashes
                                                                              └─ Reverts on duplicate
```

---

## File Structure (new / modified)

- Modified: [apps/web/src/lib/stellar.ts](file:///Users/jeffreyvillamil/Desktop/theblokc/zelyo/apps/web/src/lib/stellar.ts) — implement `submitVerifyAndRegister`
- Modified: [apps/web/src/server/verification.service.ts](file:///Users/jeffreyvillamil/Desktop/theblokc/zelyo/apps/web/src/server/verification.service.ts) — integrate `onchain` verification mode
- Modified: [contracts/verifier](file:///Users/jeffreyvillamil/Desktop/theblokc/zelyo/contracts/verifier) — implement native verification logic using Soroban SDK
- Modified: [contracts/credential_registry](file:///Users/jeffreyvillamil/Desktop/theblokc/zelyo/contracts/credential_registry) — wire verification logic to `verify_and_register`
- Create: `apps/web/src/app/api/sep12/route.ts` — mock/draft endpoint for SEP-12 KYC collections
- Create: `apps/web/src/lib/passkey.ts` — configuration helper for `passkey-kit`
- Create: `apps/web/src/lib/launchtube.ts` — fee-sponsorship integration

---

## Detailed Task Breakdown

### Task 10.1: Native On-Chain Verification (Path A)

**Description:**
Wire the currently-stubbed Path A flow. Using Protocol 25/26's BN254 pairing and Poseidon primitives, compile the Soroban verifier contract and deploy it, replacing the off-chain mock verification logic.

**Status:** Partial / blocked on testnet capabilities.

**Audit findings (2026-07-06):**
- The prerequisites are complete and tested.
- The verifier contract imports `Bn254G1Affine`/`Bn254G2Affine` but never uses the proof, public inputs, or VK; it creates empty point vectors and returns `true` unconditionally for any non-empty proof.
- This contradicts the Phase 0 decision record (`docs/superpowers/decisions/zk-verify-mode.md`), which found that Soroban testnet (protocol 27) exposes no BN254 pairing or Poseidon host primitive capable of verifying an UltraHonk proof.
- Running `ZK_VERIFY_MODE=onchain` in production would submit real proofs to a contract that cannot validate them.

**Remaining work:**
- [x] **Revert to safe default** — Set `ZK_VERIFY_MODE=server` in `.env` so the live flow uses the already-working Path B (bb.js off-chain verify + `CredentialRegistry.register`). *Completed 2026-07-06.*
- [x] **Honest verifier stub** — Changed `contracts/verifier/src/lib.rs` to return `false` for all proofs with a comment referencing the decision record; removed the misleading empty `pairing_check` call and BN254 type imports. *Completed 2026-07-06.*
- [x] **Update Path A tests** — Renamed `verify_and_register_path_a_happy_path` to `verify_and_register_path_a_disabled` and changed it to expect an `InvalidProof` revert, reflecting that on-chain verification is disabled. Removed the orphaned happy-path snapshot. *Completed 2026-07-06.*
- [x] **Correct documentation** — Updated `docs/features.md` to clarify that Task 10.1 is blocked by missing testnet host functions and that Path B remains the active mode. Added a note to `apps/web/src/lib/stellar.ts#submitVerifyAndRegister` documenting the Path A limitation. Updated this plan file with the audit results. *Completed 2026-07-06.*

**Still blocked / no further code change possible:**
Real native on-chain UltraHonk verification cannot be implemented until Soroban testnet/mainnet exposes working BN254 pairing **and** Poseidon host functions, and a `no_std` UltraHonk verifier can be compiled into the Soroban WASM. Until then, the contract API (`verify(proof, public_inputs)`) is preserved so the registry wiring does not bit-rot.

---

### Task 10.2: Reusable-KYC for Anchors (SEP-12)

**Description:**
Expose a standardized SEP-12 KYC API. Anchors can query Zelyo's server to check if an account is verified. A third-party anchor requests verification, the user provides a ZK proof of KYC status, and Zelyo returns a compliant response.

**Tasks:**
- [ ] **Step 1: Define SEP-12 schema and types** — Define compliant fields matching SEP-9 (e.g. `id_type`, `country_code`).
- [ ] **Step 2: Build `GET /api/sep12/customer`** — Handle anchor status queries (`NEEDS_INFO`, `ACCEPTED`).
- [ ] **Step 3: Build `PUT /api/sep12/customer`** — Handle anchor submission of identity requests.
- [ ] **Step 4: Build ZK proof validation for KYC** — Integrate a gate checking proof of age or residency.

---

### Task 10.3: Passkeys & Gasless Transactions (Launchtube)

**Description:**
Improve user onboarding and transaction execution. Use passkeys for non-custodial holder keys and fee-sponsored transactions via Launchtube so users don't need XLM to register claims.

**Tasks:**
- [ ] **Step 1: Setup Passkey registration** — Integrate `passkey-kit` client-side in the key setup page (`/wallet/keys`).
- [ ] **Step 2: Setup SEP-45 Contract Signatures** — Allow contract wallets to sign credentials.
- [ ] **Step 3: Configure Launchtube client** — Build transaction submission relay targeting the fee-sponsorship service.
- [ ] **Step 4: Integrate into Claim Flow** — When claiming a gate reward, relay the transaction via Launchtube.

---

### Task 10.4: Token-Gated Rewards & Asset Controls (SEP-8)

**Description:**
Integrate ZK identity gates with token supply controls. Use SEP-8 to regulate asset transfers based on on-chain nullifier/verification flags.

**Tasks:**
- [ ] **Step 1: Build SEP-8 approval server endpoint** — `POST /api/sep8/approve` checking if `boundAddress` is verified.
- [ ] **Step 2: Integrate Regulated Asset rewards** — Add support in `GateForm` to specify SEP-8 assets.
- [ ] **Step 3: Verify transfer rejection** — Test that transfers to non-verified addresses are blocked by the approval server.
