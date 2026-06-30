# Zelyo — Remaining Tasks from Implementation Plan

> Derived from `docs/superpowers/` and the current codebase. The project has 8 phases numbered 0–7; there is no Phase 8.

---

## Phase 1 — ZK Circuit

| # | Task | Description | Deployment-related? |
|---|------|-------------|---------------------|
| 1.1 | **Range / date predicate** | The circuit hashes `issue_date` but only supports equality disclosure of `track`. The design doc lists a "Could" range/date predicate (e.g., prove issue date is after X) as part of the build scope. | No |

---

## Phase 2 — Soroban Contracts

| # | Task | Description | Deployment-related? |
|---|------|-------------|---------------------|
| 2.1 | *Verifier-chosen trusted issuers* | The design mentions verifier-chosen trusted issuers as a "Could" in Phase 2. Current contract only has a single stored issuer. | No |
| 2.2 | *Root revocation smoke test on testnet* | `revoke_root` exists in the contract with Rust tests; ensure it's exercised against deployed testnet contracts and the web flow surfaces it. | No (test/integration) |

---

## Phase 4 — Mint Flow

| # | Task | Description | Deployment-related? |
|---|------|-------------|---------------------|
| 4.1 | **Fix mint "Sealed" confirmation race** | The mint log `EventSource` opens *after* the synchronous mint POST completes, so the client misses the `done` event and stays on "awaiting authorization". A real admin would see no success confirmation. | No |
| 4.2 | **Fix `ERR_INVALID_STATE` / "Controller is already closed" flood** | The mint-log SSE writes to a closed controller when the client disconnects, causing repeated uncaught exceptions. Pollutes server logs and may leak resources. | No |

---

## Phase 5 — Holder Wallet + Prove/Verify

| # | Task | Description | Deployment-related? |
|---|------|-------------|---------------------|
| 5.1 | ~~Wire on-chain proof verification (Path B)~~ **Done (Jun 30, 2026 — commit `7adb3e2`)** | `stellar.ts` stubs replaced with real implementations; `UltraHonkBackend` + ACIR bytecode for off-chain verify; `ScMap` key ordering fixed (lexicographic sort); `publicInputOrder` corrected in `zk-build.mjs`; contract WASM rebuilt with rustc 1.91.0 (hash `3789a5cf...`); end-to-end verified: proof → off-chain verify → `register` tx → result page loads. | Yes (contract redeploy was needed; WASM hash changed) |
| 5.2 | *(Optional) Implement Path A on-chain verification* | `submitVerifyAndRegister` is still stubbed. Only needed if the decision gate flips back to Path A (`onchain`). | No |
| 5.3 | ~~Drop `test.fixme` from reveals e2e~~ **Done (Jun 30, 2026 — commit `7adb3e2`)** | `.fixme` removed from tests 13.1/13.2/13.3 in `tests/e2e/reveals.spec.ts`; STATUS comment updated. Path B verification confirmed working — result page loads, nullifier stored, Sybil block enforced. | No (test) |

---

## Phase 6 — Reveals & Money-Rails

| # | Task | Description | Deployment-related? |
|---|------|-------------|---------------------|
| 6.1 | **End-to-end reveal 13.1 — nothing personal on-chain** | Requires 5.1. Confirm result page shows nullifier + explorer link, no PII. | No |
| 6.2 | **End-to-end reveal 13.2 — Sybil block** | Requires 5.1. Confirm second proof with the same nullifier yields `NULLIFIER_USED`. | No |
| 6.3 | ~~End-to-end reveal 13.3 — selective disclosure unlocks a claim~~ **Done (Jun 30, 2026)** | **Fixes applied**: (1) `ClaimPanel` SSR crash — `window.location` moved to server `searchParams`; server page passes `initialTxHash/initialNullifierHex/initialBoundAddress` as props; (2) `disclosed` data model changed from hex hash to `{ value: FieldHex, raw: { track: string } }` — plaintext `raw.track` for gate predicate check, hash `value` for proof; (3) test mint track changed `"data-engineering"` → `"Data Engineering"` to match gate predicate; (4) "Claim Your Reward" link added to result page. **Manual verify**: mint (track=Data Engineering) → prove (disclose track only) → verify → result page → click "Claim Your Reward" → land on `/jobs/data-engineering?txHash=...` → button is "Claim Your Reward" (not "Prove with Zelyo") → click → "Reward Unlocked". | No |
| 6.4 | ~~Real claimable-balance / verified-flag smoke test~~ **Done (Jun 30, 2026)** | **Fix applied**: seed `rewardConfig` changed from `{ asset: "native" }` (string) to `{ asset: { code: "XLM", issuer: "", amount: "10" } }` (object) to match `issueClaimableBalance` expectations. **Manual verify**: after 6.3 claim succeeds, query Horizon API: `curl "https://horizon-testnet.stellar.org/accounts/BOUND_ADDRESS/claimable_balances"` → should return XLM 10 claimable balance. | No (test/integration) |

---

## Phase 7 — Hardening, Tests & Deploy

| # | Task | Description | Deployment-related? |
|---|------|-------------|---------------------|
| 7.1 | **Verify security headers in prod** | CSP nonce + `strict-dynamic`, COOP/COEP, HSTS, XFO, XCTO, Referrer-Policy all present. This PR addresses the nonce-CSP bug; verify after merge. | Yes |
| 7.2 | **Rate-limit / audit / redaction tests green** | `tests/unit/rate-limit.test.ts`, `audit.test.ts`, `redaction.test.ts` exist; ensure they run and pass in CI. | No (CI) |
| 7.3 | **Run full Phase-7 acceptance gate** | `docker compose up -d` → `pnpm i --frozen-lockfile` → prisma migrate/seed → `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:e2e` → `pnpm audit --audit-level critical`. | Yes (release gate) |
| 7.4 | **e2e.yml against `develop` after merge** | Currently triggers on `push` to `develop` or manual `workflow_dispatch`. The e2e suite should be run on `develop` after this PR merges and the `CI_*` secrets are set. | Yes |
| 7.5 | **Railway deploy smoke test** | `railway.json` + `nixpacks.toml` exist. Validate a real deploy: web build/release/start, COOP/COEP headers in prod, contract IDs as variables, secrets via Railway only. | Yes |
| 7.6 | *Add `playwright-report/` and `test-results/` to `.gitignore`* | Generated e2e artifacts are currently untracked and could be accidentally committed. | No (repo hygiene) |

---

## Cross-cutting / Not phase-specific

| # | Task | Description | Deployment-related? |
|---|------|-------------|---------------------|
| C.1 | *Consider tightening the middleware matcher* | Current matcher runs on `/public` static files; exclude paths with file extensions to avoid wasted auth/CSP work per asset. | No (perf) |
| C.2 | *Consider `export const dynamic = "force-dynamic"` in root layout* | More idiomatic than `await headers()` for forcing dynamic render + nonce application. | No (code clarity) |

---

## Legend

- **Bold** = currently blocking the end-to-end spine or acceptance.
- *Italic* = Could / should / cleanup, not currently blocking.

---

## Suggested order

5.1, 5.3, 6.3, and 6.4 are complete. **6.1 and 6.2** are unblocked by 5.1 but should be manually validated:

1. **6.1 → 6.2** — manual verification: mint → prove → verify → result page (13.1: no PII); re-prove same nullifier → Sybil block (13.2: NULLIFIER_USED)
2. **4.1** — mint SSE "awaiting authorization" bug (Redis Pub/Sub is ephemeral; `SEALED` event published before EventSource connects; fix requires Redis Streams)
3. **7.3** — full Phase-7 acceptance gate locally.
4. **7.4 → 7.5** — e2e on `develop`, then Railway deploy smoke test.

Parallel (no spine dependency): **4.2** (SSE controller closed error), **7.6 / C.1 / C.2** (hygiene), **7.1 / 7.2** (confirm already satisfied), **1.1** and **2.1** (pure "Could" scope additions).

---

## Zelyo — What It Does

Privacy-preserving verifiable credentials on Stellar. An issuer (e.g., a course provider) mints credentials as Merkle-tree leaves on Soroban. Holders can prove facts in zero knowledge — e.g. "I completed the JavaScript track" — revealing only a nullifier and the specific attribute, never their name, grade, or identity.

**Core property**: Prove one fact. The chain records only a nullifier hash — never who you are.

### The Three Actors

| Role | Who | What they do |
|------|-----|---------------|
| ADMIN / ISSUER | Course provider (you) | Mint credentials, revoke them, publish roots on-chain |
| HOLDER | Learner | Generate identity keys, receive credentials, prove facts (selective disclosure) |
| ANYONE | Employer, service | Verify a proof, query nullifier state |

### The Credential Lifecycle

```
ISSUER mints                    HOLDER proves              ON-CHAIN              HOLDER claims
─────────────────               ─────────────────         ─────────────         ────────────────
Credential attributes    →      Secret s (never leaves     register(pi,         Job gate reward:
  track, grade, etc.          browser) + Stellar address    attestor, holder)    CLAIMABLE_BALANCE
                              + scope + nullifier                                   or FLAG
                                   ↓
Merkle leaf =                  ZK proof generated          Nullifier stored     Reward issued
Poseidon(idCommitment,         in browser via bb.js        on Soroban           to holder's
Poseidon(attributes))                                          ↓               Stellar address
                              ProofBundle POSTed            Sybil block:         via Horizon
Root published                  to /api/verify               same nullifier       createClaimableBalance
on-chain via                                              can't be reused
set_root()
```

### Every Route Explained

#### Public

| Route | What it is |
|-------|------------|
| `/` | Landing page — explains the 3 reveals |
| `/jobs` | Job gate board — lists all available gates/rewards |
| `/jobs/[slug]` | Gate detail — shows requirements + claim panel (appears after you verify) |
| `/verify/result/[txHash]` | Post-verification — shows nullifier hash + explorer link, zero PII |

#### Auth

| Route | What it is |
|-------|------------|
| `/login` | Sign in as admin or holder |
| `/register` | Register as a holder — creates your identity keypair |

#### Issuer (Admin only)

| Route | What it is |
|-------|------------|
| `/issuer` | Dashboard — stats, overview |
| `/issuer/mint` | MintForm — mint a credential to a holder: fills in learner name, track, grade, etc.; publishes root on-chain |
| `/issuer/credentials` | Folio library — list all minted credentials, revoke them |

#### Holder / Wallet

| Route | What it is |
|-------|------------|
| `/wallet` | Your credential wallet — lists credentials you've received |
| `/wallet/keys` | Generate your secret s, sealed with a passphrase; publishes idCommitment = Poseidon(s) — your public identity |
| `/wallet/credentials/[id]` | Credential detail + downloadable VC JSON |
| `/wallet/prove/[id]` | ProvePanel — select which attributes to disclose (checkboxes), enter your Stellar bound address, generate ZK proof in-browser |

#### API Routes (behind the pages)

| Route | What it does |
|-------|-------------|
| `POST /api/verify` | Takes a ZK proof bundle → off-chain verifies via bb.js → submits register() to Soroban if valid → stores nullifier |
| `GET /api/verify/[txHash]` | Look up a verification by its transaction hash |
| `GET/POST /api/issuer/credentials` | List all credentials / mint a new one |
| `POST /api/issuer/credentials/[id]/revoke` | Revoke a credential — zeroes its leaf, removes root |
| `GET /api/issuer/credentials/mint-log/[jobId]` | SSE stream of mint progress steps (RESOLVE_HOLDER → BUILD_LEAF → INSERT_LEAF → PUBLISH_ROOT → WRITE_VC → SEALED) |
| `PUT /api/holder/commitment` | Publish your idCommitment after generating keys |
| `GET /api/holder/credentials` | List your (holder's) credentials |
| `GET /api/holder/credentials/[id]/vc` | Download your VerifiableCredential JSON |
| `POST /api/jobboard/gates/[slug]/claim` | Claim a job gate reward — checks your verification + disclosed attribute matches the gate predicate, then issues CLAIMABLE_BALANCE or FLAG |

### The ZK Circuit (Noir, depth-20 Merkle + Poseidon2)

**Private inputs** (only in your browser, never sent to server):
- Your secret s
- The credential attributes (track, grade, issueDate)
- The 20 Merkle sibling hashes

**Public inputs** (committed to the proof):
- `root` — current Merkle root (on-chain)
- `scope` — Poseidon(app_id | chain_id | registry_id) — binds nullifier to this specific app
- `bound_address` — your Stellar public key, field-packed mod BN254
- `nullifier` — Poseidon(s, scope) — unique per holder per app; stored on-chain after use
- `disclosed` — Poseidon(track) — the only attribute actually revealed

The circuit verifies: I own secret s, the credential is in the Merkle tree at root root, and I'm revealing only track.

### Key Security Properties

1. `s` never leaves your browser — only idCommitment = Poseidon(s) is public
2. Nullifier = Sybil block — Poseidon(s, scope) stored on-chain after use; can't be replayed
3. Selective disclosure — only track checkbox is revealed; grade/name/course never leave the browser
4. Address binding — proof is cryptographically tied to your Stellar wallet
5. Zero PII on-chain — only nullifier, root, scope, bound_address (all cryptographic hashes)

### The Job Gate Flow

```
You verify (Prove → /api/verify)
    ↓
POST /api/jobboard/gates/[slug]/claim
    ↓
claimGate() checks:
  1. Verification exists for your txHash + nullifier
  2. Your disclosed track == gate.requiredPredicate.track
  3. Not already claimed (idempotent)
    ↓
REWARD TYPE:
  CLAIMABLE_BALANCE → Horizon API creates a claimable balance
                      → you claim it via any Stellar wallet (Lobstr, Keybase, etc.)
  FLAG → Soroban contract sets is_verified(YOUR_ADDRESS) = true
```
