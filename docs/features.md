# Zelyo — shipped features log

A running, append-only log of shipped changes. Newest entries on top.

## Phase 7 — Hardening, Tests & Deploy

- **Centralized security headers (`lib/security-headers.ts`)** (#69) — `securityHeaders(isProd)` + `cspValue(isProd)` become the single source of truth for CSP, COOP/COEP, XFO, XCTO, Referrer/Permissions-Policy, and HSTS in production. Wired into `next.config.ts` with global `/:path*` coverage; assertion tests lock in the AGENT.md §4 header set and CSP rules.

- **Rate-limiting sweep across mutating endpoints** (#70) — Add `claim` to the named `limiters` registry (SPEC §8 floors: auth 10, verify 20, register 5, mint 60, claim 20 per minute). Introduce `enforceRateLimit(name, ip)` in `lib/rate-limit.ts` and switch the job-board claim route to use it, returning `429` + `Retry-After` on exhaustion. Assertion tests lock in the floors and the `RATE_LIMITED` error shape.

## Phase 6 — Reveals & Money-Rails

- **Explorer URL helper (`lib/explorer.ts`)** (#58) — `explorerTxUrl(txHash)` joins `NEXT_PUBLIC_EXPLORER_BASE` to `/tx/<hash>`, trailing-slash-safe and tolerant of an unset base. Consolidated as the single source of truth; `lib/stellar.ts` now re-exports it (verification.service keeps importing from `@/lib/stellar`). Env key was already wired in Phase 5.

- **Verification read service (`verification-read.service.ts`)** (#59) — `getVerificationByTxHash` returns a `VerificationView` (txHash, result, nullifierHex, boundAddress, disclosed, explorerUrl, createdAt, jobGateSlug) for the result page + Sybil mirror lookup. Read-only, never touches the chain.

- **`ExplorerRevealPanel`** (#60) — pure presentational panel with two states: the verified "nothing personal is recorded on-chain" reveal (nullifier + bound address + tx + foil-stamp explorer link) and the `NULLIFIER_USED` Sybil-block state (no explorer link). Test asserts disclosed attribute *values* never render.

- **`/verify/result/[txHash]` page** (#61) — async Server Component awaiting `params`; `notFound()` when no mirror row, otherwise renders `ExplorerRevealPanel`. Includes a branded `not-found.tsx`.

- **Stellar reward helpers** (#62) — `issueClaimableBalance(boundAddress, asset)` (Horizon `createClaimableBalance`, unconditional claimant) and `setVerifiedFlag(boundAddress)` (registry `set_verified` via Soroban RPC), both signed server-side with `ISSUER_SECRET`, reusing the module's `issuerKeypair`/`rpcServer`.

- **`jobgate.service.ts`** (#63) — `listGates`/`getGate` read helpers + `claimGate(slug, nullifierHex, boundAddress, txHash)`: requires a `VERIFIED` `Verification` row whose `disclosed.track` matches the gate predicate, idempotent per `@@unique([jobGateId, nullifierHex])`, dispatches `CLAIMABLE_BALANCE` vs `FLAG`, records a `GateClaim`.

- **Job board APIs (`/api/jobboard/gates/*`)** (#64) — `GET` list, `GET` detail (404 on unknown slug), `POST` claim (Zod-validated body, 10/min/IP rate limit → 429 + Retry-After, audited). New `lib/audit.ts` writes claim attempts (success + rejection) to `AuditLog` with hashes/txHashes only — no PII.

- **`GateCard` + `/jobs` board** (#65) — server-rendered gate list; each card shows title, description, and the single disclosed predicate, linking to the gate detail.

- **`ClaimPanel` + `/jobs/[slug]`** (#66) — client component reading `txHash`/`nullifier`/`address` from the post-verification redirect query: shows "Prove with Zelyo" deep-link (`/wallet/prove?gate=<slug>`) or a "Claim Your Reward" button posting to the claim API, surfacing `PROOF_NOT_ELIGIBLE`/`NULLIFIER_USED` as plain copy.

- **Landing three-reveal narrative** (#67) — `RevealNarrative` renders the three acceptance reveals (nothing-personal / one-credential-one-registration / selective-disclosure) with role CTAs to `/issuer`, `/wallet`, `/jobs`; replaces the Phase 3 placeholder home page.

- **Phase 6 gate** — `pnpm --filter @zelyo/web typecheck && lint && test` all green (54 files, 130 tests).

### Plan deviations (vs `docs/superpowers/plans/2026-06-23-zelyo-07-reveals.md`)

The plan code targeted slightly different lib names/signatures than what actually landed in Phases 3–5; adapted to the real codebase:

- **DB client is `db`, not `prisma`** (`lib/db.ts`) — services + test mocks use `db`.
- **No `withErrorBoundary`** — routes use the established `try/catch` + `toErrorResponse` pattern (matches `api/verify`).
- **`rateLimit()` returns `{ ok, retryAfter }`** (doesn't throw) — the claim route throws `RateLimitError` when `!ok`.
- **`lib/audit.ts` created here** (the plan assumed it existed from Phase 3) — minimal `AuditLog` writer; Phase 7 §T3 will extend the audit sweep.
- **`explorerTxUrl` already existed** in `stellar.ts` — kept one implementation in `lib/explorer.ts` and re-exported.
- **Prisma models already present** (`JobGate`, `GateClaim`, `AuditLog`, `Verification.jobGate`) — no migration needed.
- **Self-inconsistent plan tests fixed** — `ExplorerRevealPanel`/`GateCard` tests used over-broad text regexes that matched their own copy; rewritten to assert intent (no leaked PII values; predicate present). The jobboard claim test used a non-hex `nullifierHex` that failed the route's own schema; replaced with valid hex. `nativeToScVal(true)` (no invalid `{type:"bool"}`); idempotent `claimGate` omits `txHash` when null under `exactOptionalPropertyTypes`.

## Phase 5 — Holder Wallet + Prove/Verify

- **Client-side holder secret (`holder-key.client.ts`)** (#49) — WebCrypto 32-byte random reduced to BN254 field; AES-GCM encrypted IndexedDB persistence; export/restore versioned backup blob; `deriveIdCommitment` wraps `@zelyo/zk-shared`. Secret `s` never serialized to the network. `fake-indexeddb` added for jsdom tests; connection handles closed to avoid test deadlocks.

- **In-browser UltraHonk prover (`prover.client.ts`)** (#50) — Loads circuit manifest from `/api/circuit/manifest`, builds public inputs with zk-shared (`computeScope`, `computeNullifier`, `encodeAddressToField`, `poseidon`), executes Noir witness, generates proof via `@aztec/bb.js` `UltraHonkBackend`. Injected deps enable unit tests without WASM; `assertCrossOriginIsolated()` throws `ProverError("NOT_ISOLATED")` before touching SharedArrayBuffer.

- **`verifyAndRegister` service (`verification.service.ts`)** (#51) — Fast-fail on unknown root / used nullifier; Path A (`submitVerifyAndRegister`) and Path B (`verifyProofOffchain` → `submitRegister`) gated by `ZK_VERIFY_MODE`. Maps `NullifierUsed`/`InvalidProof`/`UnknownRoot` to `VerificationResult`; mirrors `Nullifier` + `Verification` rows. Stellar helpers added as stubs in `lib/stellar.ts` (wired in Phase 7).

- **Holder APIs (`/api/holder/*`)** (#52) — `GET /api/holder/credentials` returns credentials with merkle path/root; `GET /api/holder/credentials/[id]/vc` returns a short-lived signed URL; `PUT /api/holder/commitment` upserts `idCommitment` with a strict Zod schema that rejects any payload containing the secret `s`. HOLDER RBAC enforced in every handler.

- **Public verify APIs (`/api/verify`, `/api/verify/[txHash]`)** (#53) — `POST /api/verify` validates `{ proof, publicInputs }`, rate-limits 20/min per IP, rejects `s`, reconstructs `Uint8Array` proof, and returns the `VerifyResult`. `GET /api/verify/[txHash]` returns the mirrored verification record.

- **Prove panel (`ProvePanel`)** (#54) — Selective-disclosure checkboxes default to `track` only; Stellar address + vault passphrase inputs; foil-stamp "Generate ZK-Proof" CTA; typewriter prove log via real `LogLine[]`; proves in-browser, POSTs to `/api/verify`, routes to `/verify/result/[txHash]`, surfaces Sybil rejection (`NULLIFIER_USED`) inline.

- **Wallet pages + credential cards** (#55) — `/wallet` lists holder credentials as `CredentialCard` (no PII on card); `/wallet/credentials/[id]` shows track/issuer/date/root/leaf + raw VC download via `VcDownloadButton`. BRAND-styled with foil-stamp links and typewriter hashes.

- **Prove page (`/wallet/prove/[id]`)** (#56) — Server Component authorizes HOLDER, loads the credential + merkle proof, and renders `ProvePanel`.

- **Keys page (`/wallet/keys` + `KeysManager`)** (#57) — Client-only generate/backup/restore for the holder secret; only the public `idCommitment` is published via `PUT /api/holder/commitment`.

- **Phase 5 gate** — `pnpm --filter @zelyo/web typecheck && pnpm --filter @zelyo/web lint && pnpm --filter @zelyo/web test` all green (44 files, 106 tests).

## Phase 3 — Web Foundation, Theme & Auth

- **Next.js 16 app scaffold + security headers** (#24) — `apps/web/package.json` (Next 16.2, React 19.2, Auth.js v5 beta, Prisma, Tailwind v4 deps), strict `tsconfig.json`, `next.config.ts` with global CSP/COOP/COEP/hardening headers, Vitest + jsdom + RTL setup, minimal `layout.tsx`/`page.tsx`. Header test passes; `pnpm --filter @zelyo/web test` green.

## Phase 2 — Soroban Contracts

- **`pnpm contracts:deploy` (testnet deploy + env wiring)** (#23) — `scripts/deploy-contracts.ts` funds the deployer via Friendbot, deploys `verifier.wasm` and `credential_registry.wasm` to Stellar testnet, initializes the registry, and writes `VERIFIER_CONTRACT_ID` + `CREDENTIAL_REGISTRY_CONTRACT_ID` into `.env`. `package.json` `contracts:deploy` runs via `tsx`; `@stellar/stellar-sdk`, `tsx`, and `dotenv` added as root dev dependencies. Verified end-to-end: contracts deployed and initialized.

- **`pnpm contracts:build` + wasm-compatible address extraction** (#22) — `package.json` `contracts:build` runs `stellar contract build` from `contracts/` so `rust-toolchain.toml` (Rust 1.92.0) is honored. Enabled `soroban-sdk/hazmat-address` and rewrote `checks::address_to_key32` plus the test helper to use `AddressPayload::to_payload()`, which works in `wasm32v1-none` release builds. Verified both `credential_registry.wasm` and `verifier.wasm` are produced optimized. `cargo test` green.

- **Storage keys + `set_root` + `is_root_valid`** (#18) — `storage.rs` with `DataKey` enum (Issuer, Attestor, Verifier, Root, Nullifier), role storage in instance storage, root/nullifier in persistent storage. `initialize`, `set_root` (issuer-only via `require_auth`), `is_root_valid`. Tests for happy path and unauthorized `set_root`. `cargo test` green.

- **Contract workspace scaffold** (#17) — `contracts/Cargo.toml` workspace (members `credential_registry`, `verifier`), `contracts/rust-toolchain.toml` (Rust 1.92.0 + `wasm32v1-none`), `contracts/credential_registry` crate with `Error` enum (`NotAuthorized=1` … `InvalidProof=5`) and `PublicInputsXdr { root, scope, bound_address, nullifier, disclosed }`. `cargo test` and `stellar contract build` green. Uses `soroban-sdk` 26.1.0 to match current testnet protocol 27.

## Phase 1 — ZK circuit (full) + zk-shared parity

- **Noir circuit** (#9–#11) — `circuits/zelyo_credential`: depth-20 Merkle inclusion + selective disclosure (`track`) + nullifier + address binding + gated range/date predicate, with an 8-case `nargo test` suite (valid, wrong-root, wrong-disclosed, wrong-nullifier, predicate-on, predicate-out-of-bounds, leaf-helper, vector-print). Poseidon helpers in `poseidon.nr`.
- **Golden parity vectors** (#11) — `circuits/export-vectors.sh` runs the circuit's `print_parity_vectors` test and freezes the emitted field values into `packages/zk-shared/test/fixtures/parity-vectors.json` (committed source of truth).
- **`@zelyo/zk-shared` builders** (#12–#14) — real contract types (`FieldHex`, `Attributes`, `PublicInputs`, `ProofBundle`, `MERKLE_DEPTH`), BN254 field helpers + `encodeAddressToField` (Stellar StrKey → field), and Poseidon2 builders (`poseidon`, `idCommitment`, `buildLeaf`, `computeNullifier`, `computeScope`) via `@zkpassport/poseidon2`.
- **Correctness-critical parity test** (#15) — `parity.test.ts` asserts JS builders == circuit-emitted vectors for idCommitment, attrHash, leaf, and nullifier. **`@zkpassport/poseidon2` matches Noir's `poseidon::poseidon2::Poseidon2::hash` bit-for-bit** across 1/2/3-input hashes — the plan's main risk, resolved with no fallback needed.
- **Build pipeline** (#16) — `scripts/zk-build.mjs` wired to `pnpm zk:build`: `nargo compile` → export ACIR/ABI → `bb write_vk` → `manifest.json` (abiHash, merkleDepth, scopeAppId, 8-entry publicInputOrder). Outputs gitignored; `abiHash` reproducible.
- **CI gate (carried forward)** — `.github/workflows/ci.yml` was authored in Phase 0 but did **not** land in the #79 merge (merged at `1fcf562`, before the CI commits). Re-added here so `develop` gets the build+test gate when this PR merges.

### Toolchain / plan deviations (vs `docs/superpowers/plans/2026-06-23-zelyo-02-zk-circuit.md`)

Required to compile/test under the installed beta.22 toolchain (`nargo 1.0.0-beta.22`, `bb 5.0.0-nightly` — bbup auto-resolved the bb paired with this nargo, not the plan's 4.3.x note):

- **Poseidon moved out of std** — beta.22 dropped `std::hash::poseidon2`; use the standalone `noir-lang/poseidon` v0.3.0 library (`poseidon::poseidon2::Poseidon2`). A local `hash_two` helper avoids the `mod poseidon` name shadowing the external crate in `main.nr`.
- **`u1` removed** → `bool` for Merkle indices (`[false; 20]`).
- **Explicit assert messages** so `#[test(should_fail_with = ...)]` matches (plain `assert(expr)` no longer embeds the expression in the panic text).
- **Sound predicate** — the plan's `value - lo as u64` silently truncates on underflow rather than failing; replaced with `u64` casts + real comparisons so the out-of-bounds test actually fails the circuit.
- **Noir prints fields as hex** (not decimal) — `export-vectors.sh` normalizes to 32-byte `FieldHex`; f-strings can't interpolate field access, so locals are bound first.
- **`bb write_vk`** — bb 5.0 defaults to `ultra_honk` (dropped `--scheme`); script augments PATH with the nargo/bb install dirs. Note: CI does not run `pnpm zk:build` (no toolchain in CI); the parity test runs against the committed fixture, so CI stays green without nargo/bb.

## Phase 0 — Foundation & ZK feasibility spike

- **Workspace root scaffold** (#1) — pnpm monorepo root: `package.json` (SPEC §14 script set), `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `tsconfig.base.json` (strict TS preset: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), `.npmrc`, `.nvmrc` (Node 22), `.gitignore`, placeholder `scripts/contracts-{build,deploy}.sh`. pnpm 10.33.0 pinned via `packageManager`.
- **Dev stack** (#2) — `docker-compose.yml`: postgres 16, redis 7, minio + `createbuckets` init that provisions the `zelyo` bucket. All services healthy locally.
- **`.env.example`** (#3) — full env key list (index §Env keys + `NODE_ENV`); exactly one `NEXT_PUBLIC_` (explorer base); no secret carries `NEXT_PUBLIC_`.
- **Typed env loader** (#4) — `apps/web/src/lib/env.ts`: Zod schema, `parseEnv()` (pure, unit-tested, 5 cases), and a lazy fail-fast `env` singleton. `@/` path alias, Vitest config.
- **Toolchain runbook** (#5) — `docs/toolchain.md`: nargo 1.0.0-beta.22 (noirup), bb (bbup, matching bb.js 4.3.x), Rust **1.90.0** + `wasm32-unknown-unknown` + soroban-sdk, Stellar CLI, Friendbot funding.
- **Poseidon parity rig** (#7) — `packages/zk-shared`: locked contract types (`FieldHex`, `Attributes`, `MERKLE_DEPTH`) + stub builders, Vitest parity rig with one pending vector (`expectedLeaf` filled in Phase 1).
- **Directory skeleton** (#8) — placeholder dirs for Phase 2 contracts (`contracts/credential_registry`, `contracts/verifier`) and Phase 3 web (`apps/web/public/circuit`); full-stack bootstrap smoke green.

- **ZK_VERIFY_MODE decision gate** (#6) — Ran the Phase 0 spike end-to-end: `circuits/zelyo_credential` compiles with noir-lang/poseidon v0.3.0; `spike/generate-proof.ts` produces an UltraHonk proof verified locally by bb.js; throwaway `spike/verifier` Soroban contract builds and deploys to testnet. Verdict recorded in `docs/superpowers/decisions/zk-verify-mode.md`: **Path B (`server`)** — Soroban testnet (protocol 27) lacks BN254 pairing / Poseidon host primitives, so proofs cannot be verified on-chain today. `.env.example` updated to `ZK_VERIFY_MODE=server`; `apps/web` env tests still pass.

### Plan deviations (vs `docs/superpowers/plans/2026-06-23-zelyo-01-foundation-spike.md`)

These three changes were required to make the plan's own Definition-of-Done (typecheck + tests green) pass under the pinned latest toolchain (TS 6.0.3, Zod 4.4.3):

- **Lazy `env` singleton** — the plan's eager `export const env = parseEnv(process.env)` throws at import time during unit tests (the test shell has no app env), contradicting the plan's stated goal of keeping `parseEnv` testable without booting the app. Replaced with a lazy proxy that still fails fast on first real access at boot.
- **Dropped `baseUrl`** from `apps/web/tsconfig.json` — TS 6.0 deprecates `baseUrl` (error TS5101); `paths` resolve relative to the tsconfig since TS 5.0, so it is no longer needed.
- **`@types/node` added to `packages/zk-shared`** + `types: ["node"]` — the plan's parity test imports `node:fs`/`node:path` and uses `__dirname` but the package declared no Node types, failing typecheck.
- **`boolish.default(true)`** (not `"true"`) in `env.ts` — Zod 4's `.default()` after a `.transform()` is output-typed (boolean), not input-typed.

### Spike deviations (issue #6)

Running the feasibility spike required several deviations from the plan's toolchain and circuit assumptions:

- **Noir Poseidon is an external library in beta.22** — `std::hash::poseidon::bn254::hash_N` does not exist. Used `noir-lang/poseidon` v0.3.0 and imported `::poseidon::poseidon::bn254`.
- **bb CLI / bb.js version** — `bbup --noir-version 1.0.0-beta.22` resolved to `5.0.0-nightly.20260522`, so we used `@aztec/bb.js` 5.0.0-nightly.20260522 instead of the plan's 4.3.0.
- **Witness format** — bb.js 5.x expects the msgpack-inside-gzip witness produced by `nargo execute`; the raw Uint8Array from `@noir-lang/noir_js` does not work. `generate-proof.ts` reads `circuits/zelyo_credential/target/zelyo_credential.gz` directly.
- **Rust / Soroban toolchain** — The plan's Rust 1.90.0 pin is incompatible with `soroban-sdk` 26.1.0 (requires ≥1.91.0), and stellar-cli 27.0.0 blocks Rust 1.91.0 for contract builds. We used Rust 1.92.0 with the `wasm32v1-none` target.
- **Path B verdict** — Soroban protocol 27 / `env.crypto()` exposes no BN254 pairing or Poseidon host function, so a contract cannot verify an UltraHonk proof on-chain. `ZK_VERIFY_MODE` is set to `server`.
