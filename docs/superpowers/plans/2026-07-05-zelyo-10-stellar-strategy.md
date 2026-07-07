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
- [ ] **Task 10.3 — Passkeys & Gasless Transactions (Launchtube)**
- [-] **Task 10.4 — Token-Gated Rewards & Asset Controls (SEP-8)** — Analysis complete 2026-07-07. Blockers scoped; can proceed independently of Tasks 10.1 and 10.3. See detailed breakdown below.

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

**Status:** Analysis complete; ready for implementation. No code changes made yet.

**Dependencies and prerequisites (is it solo?):**
- **Not blocked by Task 10.3 (passkeys / Launchtube).** Task 10.4 can proceed in parallel.
- **Not blocked by Task 10.1 (Path A on-chain verification).** Path A is disabled because Soroban testnet lacks the required BN254/Poseidon host functions. SEP-8 can use the existing off-chain mirror (`Verification` table, Path B) as the source of truth for whether a Stellar account is verified.
- **Blocked-ish by the existing gate/reward infrastructure from Phase 6.** Step 2 (“Regulated Asset rewards in `GateForm`”) builds directly on `JobGate`, `GateForm`, `rewardConfig`, and `claimGate`. These are implemented and tested, so this is a dependency, not a blocker.
- **Soft dependency on Task 10.2 (SEP-12) patterns.** The SEP-12 service/route/test structure (`src/server/sep12.service.ts`, `src/app/api/sep12/customer/route.ts`, rate-limiter registration, audit logging) is the template for the new SEP-8 approval service.
- **Pre-existing issue to resolve or explicitly work around:** `apps/web/src/lib/stellar.ts#setVerifiedFlag` calls a `set_verified` method on the `CredentialRegistry` contract, but no such method exists in `contracts/credential_registry/src/lib.rs` or `storage.rs`. This means the current `FLAG` reward type will fail on-chain. For SEP-8 we should either (a) rely on the `Verification` DB mirror instead of an on-chain verified flag, or (b) add `set_verified`/`is_verified` to the contract and redeploy. Option (a) is faster and aligns with the current Path-B reality.

**Current state of relevant code:**
- `apps/web/src/server/jobgate.service.ts` — `claimGate` issues rewards. Supports `CLAIMABLE_BALANCE` (direct payment for native XLM, claimable balance for custom assets) and `FLAG` (currently calls the missing `set_verified` contract method).
- `apps/web/src/app/(issuer)/issuer/gates/GateForm.tsx` — form schema allows `rewardType: "CLAIMABLE_BALANCE" | "FLAG"` and an `asset: { code, issuer?, amount }` inside `rewardConfig`.
- `apps/web/src/lib/stellar.ts` — has `issuePayment`, `issueClaimableBalance`, `setVerifiedFlag` helpers, plus contract RPC helpers. Uses `ISSUER_SECRET` for signing.
- `apps/web/prisma/schema.prisma` — `Verification` table already stores `boundStellarAddress`, `result`, `nullifierHex`, `disclosed`, and `jobGateId`. This is the natural place to ask “has this Stellar account produced a VERIFIED proof?”
- `apps/web/src/server/verification.service.ts` — populates `Verification` rows after server-side Path-B verification.
- `apps/web/src/lib/ratelimit.ts` — named limiters registry; add a `sep8` limiter mirroring `sep12`.
- `apps/web/src/lib/audit.ts` — PII-safe audit writer already in use.

**SEP-8 model for Zelyo:**
SEP-8 is Stellar’s “Regulated Assets” protocol. The issuer sets `AUTHORIZATION_REQUIRED` + `AUTHORIZATION_REVOCABLE` on the asset, and wallets must send payment transactions to an approval server before submitting them. The approval server parses the transaction envelope, checks compliance, signs with the issuer key if approved, and returns a SEP-8 response:

```json
{ "status": "approved", "tx": "base64 signed envelope" }
// or
{ "status": "rejected", "error": "Account is not Zelyo-verified." }
```

Zelyo’s compliance rule: the destination (or relevant participant) of a regulated-asset payment must have at least one `Verification` row with `result = "VERIFIED"` and `boundStellarAddress` matching that account.

**Proposed implementation approach:**
- [ ] **Step 1: SEP-8 approval service & route**
  - Create `apps/web/src/server/sep8.service.ts` with:
    - `approveTransaction(body: { tx: string })` that decodes the base64 transaction envelope with `@stellar/stellar-sdk`, identifies payment operations for the regulated asset (asset issuer must match `ISSUER_STELLAR_ACCOUNT`), extracts the destination address, and checks `db.verification.findFirst({ where: { boundStellarAddress: destination, result: "VERIFIED" } })`.
    - If verified: re-sign the envelope with `ISSUER_SECRET` and return `{ status: "approved", tx: signedBase64 }`.
    - If not verified: return `{ status: "rejected", error: "..." }`.
  - Create `apps/web/src/app/api/sep8/approve/route.ts` `POST` handler: validate body, rate-limit (`limiters.sep8`), call service, audit (`SEP8_APPROVE`), return SEP-8 JSON.
  - Add `sep8` limiter to `apps/web/src/lib/ratelimit.ts` (30 req/min per IP, same as SEP-12).
- [ ] **Step 2: Regulated Asset reward type in `GateForm`**
  - Extend `rewardType` enum to include `"REGULATED_ASSET"` (or add a `regulated: boolean` flag inside `rewardConfig.asset`).
  - Update `gateFormSchema` / `rewardConfigSchema` in `GateForm.tsx` and `createGateInputSchema` in `apps/web/src/app/api/issuer/gates/route.ts`.
  - Update `jobgate.service.ts` `CreateGateInput` / `rewardConfigSchema` and `claimGate` so that `REGULATED_ASSET` rewards can be issued (likely as a payment/claimable balance, with the actual transfer enforcement happening via the SEP-8 approval server when the holder spends the asset).
- [ ] **Step 3: Tests**
  - Unit tests in `apps/web/src/server/__tests__/sep8.service.test.ts`: approved for verified address, rejected for unverified address, rejected for wrong asset issuer, rejected for malformed envelope.
  - Route tests in `apps/web/src/app/api/sep8/approve/route.test.ts`: 200 approved, 200 rejected, 400 malformed, 429 rate-limited.
  - Update/extend `jobgate.service.test.ts` for `REGULATED_ASSET` reward type if Step 2 adds one.
- [ ] **Step 4: Docs**
  - Append an entry to `docs/features.md` describing SEP-8 approval server and regulated-asset reward support.
  - Update `.env.example` and `apps/web/src/lib/env.ts` only if new env vars are needed (e.g., `SEP8_REGULATED_ASSET_CODE`). Probably not required if we derive the regulated asset from `rewardConfig`.

**Files expected to change:**
- `apps/web/src/server/sep8.service.ts` (new)
- `apps/web/src/server/__tests__/sep8.service.test.ts` (new)
- `apps/web/src/app/api/sep8/approve/route.ts` (new)
- `apps/web/src/app/api/sep8/approve/route.test.ts` (new)
- `apps/web/src/lib/ratelimit.ts`
- `apps/web/src/app/(issuer)/issuer/gates/GateForm.tsx`
- `apps/web/src/app/api/issuer/gates/route.ts`
- `apps/web/src/server/jobgate.service.ts`
- `apps/web/src/server/__tests__/jobgate.service.test.ts`
- `docs/features.md`

**Open questions / risks:**
1. **On-chain vs off-chain source of truth.** The plan text says “on-chain nullifier/verification flags,” but the contract has no per-address verified flag. Do we add `set_verified`/`is_verified` to the contract (requires redeploy + `cargo test`) and change `setVerifiedFlag` to use it, or use the `Verification` DB mirror? Recommendation: use the DB mirror for SEP-8 v1 to avoid coupling to a contract redeploy; document the limitation that the chain enforces only nullifier uniqueness, not address verification status.
2. **`FLAG` reward type is currently broken** because `set_verified` does not exist. If we choose to use an on-chain flag for SEP-8, we must fix `FLAG` first. If we use the DB mirror, `FLAG` remains broken and should be fixed separately.
3. **SEP-8 transaction parsing scope.** We should initially support simple `Payment` operations to the regulated asset. More complex path payments or Soroban contract invocations can be out of scope for v1.
4. **Issuer account flags.** For SEP-8 to be meaningful on testnet, the issuer account must issue the regulated asset with `AUTH_REQUIRED` + `AUTH_REVOCABLE`. This is a deployment/ops step outside the app code; document it in `docs/DEPLOY.md` if not already covered.
5. **Privacy.** The approval server must never log or return PII. It only checks the existence of a `VERIFIED` row; it does not return disclosed attributes.
