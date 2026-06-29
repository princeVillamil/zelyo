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
| 5.1 | ~~Wire on-chain proof verification (Path B)~~ **Done** | `apps/web/src/lib/stellar.ts` stubs replaced with real implementations; holder address threaded through the verify flow; contract address binding now reduces ed25519 keys `mod BN254_P`. Needs contract redeploy to activate on-chain. | Yes (redeploy) |
| 5.2 | *(Optional) Implement Path A on-chain verification* | `submitVerifyAndRegister` is still stubbed. Only needed if the decision gate flips back to Path A (`onchain`). | No |
| 5.3 | **Drop `test.fixme` from reveals e2e** | Now that 5.1 is wired, remove `.fixme` from `tests/e2e/reveals.spec.ts` 13.1/13.2/13.3 and run the reveal specs against testnet. | No (test) |

> **Deployment note for 5.1:** the code change is merged, but the currently-deployed `CredentialRegistry` was built with the old raw-key binding. To see end-to-end proofs succeed on testnet, run `pnpm contracts:deploy` after this merges and update `.env` / Railway with the new `CREDENTIAL_REGISTRY_CONTRACT_ID`, then re-publish any roots you want to prove against.

---

## Phase 6 — Reveals & Money-Rails

| # | Task | Description | Deployment-related? |
|---|------|-------------|---------------------|
| 6.1 | **End-to-end reveal 13.1 — nothing personal on-chain** | Requires 5.1. Confirm result page shows nullifier + explorer link, no PII. | No |
| 6.2 | **End-to-end reveal 13.2 — Sybil block** | Requires 5.1. Confirm second proof with the same nullifier yields `NULLIFIER_USED`. | No |
| 6.3 | **End-to-end reveal 13.3 — selective disclosure unlocks a claim** | Requires 5.1. Confirm only `track` is disclosed and the `data-engineering` gate claim succeeds. | No |
| 6.4 | *Real claimable-balance / verified-flag smoke test* | `jobgate.service.ts` and `issueClaimableBalance`/`setVerifiedFlag` exist; verify a real gate claim issues the chosen reward on testnet. | No (test/integration) |

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

With 5.1 landed, the remaining critical path is:

1. **5.3** — drop `.fixme` from `tests/e2e/reveals.spec.ts` and run the reveal specs.
2. **6.1 → 6.2 → 6.3** — validate the three reveals end-to-end on testnet.
3. **6.4** — real claimable-balance / verified-flag smoke test.
4. **7.3** — full Phase-7 acceptance gate locally.
5. **7.4 → 7.5** — e2e on `develop`, then Railway deploy smoke test.

Parallel (no spine dependency): **4.1/4.2** (mint SSE bugs), **7.6 / C.1 / C.2** (hygiene), **7.1 / 7.2** (confirm already satisfied).

Last: **1.1** and **2.1** (pure "Could" scope additions).
