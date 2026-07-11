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
- [x] **Task 10.2 — Reusable-KYC for Anchors (SEP-12)** — Implemented 2026-07-06: SEP-12 customer API (`/api/sep12/customer`) with GET/PUT, `Sep12Customer` schema/migration, ZK verification binding, rate limiting, audit logging, and unit tests.
- [x] **Task 10.3 — Passkeys & Gasless Transactions (OpenZeppelin Stellar Channels)**
- [x] **Task 10.4 — Token-Gated Rewards & Asset Controls (SEP-8)** — Implemented 2026-07-07. SEP-8 approval server, `REGULATED_ASSET` reward type, auto-generated gate slug, and tests. See detailed breakdown below.

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
- Create: `apps/web/src/lib/channels.ts` — fee-sponsorship integration via OpenZeppelin Stellar Channels

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

**Status:** Implemented 2026-07-06.

**What was built:**
- [x] **Step 1: SEP-12 schema and types** — Defined `Sep12Status`, `Sep12Field`, `Sep12ProvidedField`, and `Sep12CustomerResponse` in `apps/web/src/server/sep12.service.ts`. Added `Sep12Customer` model to `prisma/schema.prisma` with `stellarAccount`, `memo`/`memoType`, `status`, and `verificationId`. Created migration `20260706095912_add_sep12_customer`.
- [x] **Step 2: `GET /api/sep12/customer`** — Built `apps/web/src/app/api/sep12/customer/route.ts` `GET` handler and `getCustomer` service. Accepts `id` or `account` (+ optional `memo`/`memo_type`) and returns `NEEDS_INFO` or `ACCEPTED` with the required/provided `verification_id` field.
- [x] **Step 3: `PUT /api/sep12/customer`** — Built `PUT` handler and `putCustomer` service. Accepts `account`, optional `memo`/`memo_type`, and `verification_id`. Validates the referenced `Verification` is `VERIFIED` and bound to the same Stellar account, then upserts the customer as `ACCEPTED`. Without a `verification_id`, creates/returns a `NEEDS_INFO` record.
- [x] **Step 4: ZK proof validation for KYC** — Reuses the existing `Verification` table as the proof-of-KYC. `putCustomer` checks `verification.result === "VERIFIED"` and `verification.boundStellarAddress === account`, ensuring the ZK proof was issued for the account being registered.

**Additional hardening:**
- Added `sep12` rate limiter (30 req/min per IP) in `apps/web/src/lib/ratelimit.ts`.
- Added PII-safe `audit()` calls for both GET and PUT.
- Added unit tests in `apps/web/src/server/__tests__/sep12.service.test.ts` and `apps/web/src/app/api/sep12/customer/route.test.ts`.

**Files changed:**
- `apps/web/src/server/sep12.service.ts` (new)
- `apps/web/src/app/api/sep12/customer/route.ts` (new)
- `apps/web/src/app/api/sep12/customer/route.test.ts` (new)
- `apps/web/src/server/__tests__/sep12.service.test.ts` (new)
- `apps/web/src/lib/ratelimit.ts`
- `apps/web/prisma/schema.prisma`
- `apps/web/prisma/migrations/20260706095912_add_sep12_customer/migration.sql` (new)
- `docs/features.md`

**Future extensions (out of scope):**
- Anchor authentication (e.g., SEP-10 JWT or API keys) so only registered anchors can query customer status.
- Support for additional SEP-12 fields if Zelyo ever needs to attest to specific attributes (currently only binary KYC status is exposed).
- `DELETE /api/sep12/customer` for GDPR-style deletion requests.

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
Integrate ZK identity gates with token supply controls. Use SEP-8 to regulate asset transfers based on Zelyo verification status.

**Status:** Implemented 2026-07-07.

**What was built:**
- [x] **Step 1: SEP-8 approval server** — Created `apps/web/src/server/sep8.service.ts` with `approveTransaction`, which parses a base64 XDR envelope, inspects `Payment` operations for the Zelyo-regulated asset (issuer must match `ISSUER_STELLAR_ACCOUNT`), checks that every destination has a `VERIFIED` Zelyo proof in the `Verification` table, and either co-signs with `ISSUER_SECRET` or returns a SEP-8 rejection. Created `POST /api/sep8/approve` in `apps/web/src/app/api/sep8/approve/route.ts` with rate limiting (`limiters.sep8`), audit logging, and SEP-8 JSON responses.
- [x] **Step 2: Regulated Asset reward type** — Extended `GateForm` reward type enum to include `"REGULATED_ASSET"`, added UI radio button and asset config block with context-aware placeholders/help text, and made the gate slug auto-generate from the title. Updated `apps/web/src/app/api/issuer/gates/route.ts` and `apps/web/src/server/jobgate.service.ts` to validate and dispatch `REGULATED_ASSET` rewards (custom assets use claimable balances; native XLM uses direct payment).
- [x] **Step 3: Tests** — Added `apps/web/src/server/__tests__/sep8.service.test.ts` and `apps/web/src/app/api/sep8/approve/route.test.ts`. Extended `apps/web/src/server/__tests__/jobgate.service.test.ts` with a `REGULATED_ASSET` claim case.
- [x] **Step 4: Docs** — Appended SEP-8 / regulated-asset entry to `docs/features.md`. Created root plan file `TASK_10_4_SEP8_PLAN.md` capturing the approved approach and risks.

**Additional hardening:**
- Added `sep8` rate limiter (30 req/min per IP) in `apps/web/src/lib/ratelimit.ts`.
- Added `signTransactionEnvelope` helper in `apps/web/src/lib/stellar.ts` for SEP-8 co-signing.
- Added PII-safe `audit("SEP8_APPROVE", ...)` calls in the approval route.

**Files changed:**
- `apps/web/src/server/sep8.service.ts` (new)
- `apps/web/src/server/__tests__/sep8.service.test.ts` (new)
- `apps/web/src/app/api/sep8/approve/route.ts` (new)
- `apps/web/src/app/api/sep8/approve/route.test.ts` (new)
- `apps/web/src/lib/ratelimit.ts`
- `apps/web/src/lib/stellar.ts`
- `apps/web/src/app/(issuer)/issuer/gates/GateForm.tsx`
- `apps/web/src/app/api/issuer/gates/route.ts`
- `apps/web/src/server/jobgate.service.ts`
- `apps/web/src/server/__tests__/jobgate.service.test.ts`
- `docs/features.md`
- `TASK_10_4_SEP8_PLAN.md` (new)

**Known issues / out of scope:**
- The existing `FLAG` reward type remains unchanged. `lib/stellar.ts#setVerifiedFlag` calls a `set_verified` method that does not exist in `contracts/credential_registry`; fixing it requires a contract change + redeploy and is left for a separate task.
- SEP-8 enforcement on testnet/mainnet requires the issuer account to issue the regulated asset with `AUTHORIZATION_REQUIRED` + `AUTHORIZATION_REVOCABLE` flags. This is a deployment/ops step outside the app code.
- The approval server uses the off-chain `Verification` DB mirror as the source of truth for verified status. If a future requirement demands an on-chain verified flag, the `CredentialRegistry` contract must be extended with `set_verified` / `is_verified` and redeployed.

**Verification:**
- `pnpm --filter @zelyo/web lint` — 0 errors, 2 pre-existing React-Hook-Form warnings.
- `pnpm --filter @zelyo/web typecheck` — pass.
- `pnpm --filter @zelyo/web test` — 198 passed, 1 skipped (the skipped test is a build-dependent client-bundle redaction guard in `tests/unit/redaction.test.ts`).
