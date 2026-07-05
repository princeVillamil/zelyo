# Phase 10 — Stellar Ecosystem Integrations & Business Strategy

> **For agentic workers:** This is a **post-Phase-9 strategic integration plan** derived from research as of June 2026 (GitHub Issue #108). This phase focuses on turning Zelyo's prototype into an enterprise-ready privacy platform integrated with standard Stellar protocols.

**Goal:** Implement the strategic upgrades outlined in issue #108: on-chain verification (Path A) utilizing native Soroban host functions, reusable KYC (SEP-12), passkey smart-wallet bound addresses, and token-gated rewards (SEP-8).

**Prerequisites:** Phase 0–9 complete, including the working off-chain verifier (Path B), job gates, and basic claiming logic.

**Gate:** Deployed contracts verifying Noir proofs natively on-chain on Stellar Testnet (`ZK_VERIFY_MODE = onchain`); working SEP-12 KYC credential issuance draft; passkey-kit demo; token-gated asset rule verified.

---

## Implementation Status (Initiated 2026-07-05)

- [ ] **Task 10.1 — Native On-Chain Verification (Path A)**
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

**Tasks:**
- [ ] **Step 1: Update verifier contract** — Implement proof checks using native host functions (utilizing reference BN254 precompile bindings).
- [ ] **Step 2: Rebuild & deploy contracts** — Run `pnpm contracts:build` and deploy to testnet. Update `VERIFIER_CONTRACT_ID` in `.env`.
- [ ] **Step 3: Implement `submitVerifyAndRegister`** — In `stellar.ts`, write the method that packages the proof and public inputs as XDR and submits the transaction.
- [ ] **Step 4: Enable `ZK_VERIFY_MODE = onchain`** — Switch env configuration and verify that verification routes through the contract.
- [ ] **Step 5: Run tests** — Run `pnpm test` and Vitest unit suites.

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
