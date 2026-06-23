# Zelyo — shipped features log

A running, append-only log of shipped changes. Newest entries on top.

## Phase 0 — Foundation & ZK feasibility spike

- **Workspace root scaffold** (#1) — pnpm monorepo root: `package.json` (SPEC §14 script set), `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `tsconfig.base.json` (strict TS preset: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), `.npmrc`, `.nvmrc` (Node 22), `.gitignore`, placeholder `scripts/contracts-{build,deploy}.sh`. pnpm 10.33.0 pinned via `packageManager`.
- **Dev stack** (#2) — `docker-compose.yml`: postgres 16, redis 7, minio + `createbuckets` init that provisions the `zelyo` bucket. All services healthy locally.
- **`.env.example`** (#3) — full env key list (index §Env keys + `NODE_ENV`); exactly one `NEXT_PUBLIC_` (explorer base); no secret carries `NEXT_PUBLIC_`.
- **Typed env loader** (#4) — `apps/web/src/lib/env.ts`: Zod schema, `parseEnv()` (pure, unit-tested, 5 cases), and a lazy fail-fast `env` singleton. `@/` path alias, Vitest config.
- **Toolchain runbook** (#5) — `docs/toolchain.md`: nargo 1.0.0-beta.22 (noirup), bb (bbup, matching bb.js 4.3.x), Rust **1.90.0** + `wasm32-unknown-unknown` + soroban-sdk, Stellar CLI, Friendbot funding.
- **Poseidon parity rig** (#7) — `packages/zk-shared`: locked contract types (`FieldHex`, `Attributes`, `MERKLE_DEPTH`) + stub builders, Vitest parity rig with one pending vector (`expectedLeaf` filled in Phase 1).
- **Directory skeleton** (#8) — placeholder dirs for Phase 2 contracts (`contracts/credential_registry`, `contracts/verifier`) and Phase 3 web (`apps/web/public/circuit`); full-stack bootstrap smoke green.
- **CI gate** — `.github/workflows/ci.yml`: on `pull_request` targeting `develop`, runs install (`--frozen-lockfile`) → lint → typecheck → test → build (`pnpm -r --if-present build`, a no-op until the Next.js app lands in Phase 3). Concurrency-cancels superseded runs. Bootstrap note: it activates for develop PRs once this branch merges (a `pull_request` workflow does not run on the PR that first introduces it, since `develop` does not yet carry the file).

> **Deferred:** #6 (THE SPIKE — circuit → bb.js proof → on-chain verify → `ZK_VERIFY_MODE` decision) is **not** in this change. It requires the Noir toolchain (`nargo`/`bb`, absent in the build environment) plus a funded Stellar testnet run. `ZK_VERIFY_MODE` remains at the `onchain` placeholder until the spike runs. Tracked in #6.

### Plan deviations (vs `docs/superpowers/plans/2026-06-23-zelyo-01-foundation-spike.md`)

These three changes were required to make the plan's own Definition-of-Done (typecheck + tests green) pass under the pinned latest toolchain (TS 6.0.3, Zod 4.4.3):

- **Lazy `env` singleton** — the plan's eager `export const env = parseEnv(process.env)` throws at import time during unit tests (the test shell has no app env), contradicting the plan's stated goal of keeping `parseEnv` testable without booting the app. Replaced with a lazy proxy that still fails fast on first real access at boot.
- **Dropped `baseUrl`** from `apps/web/tsconfig.json` — TS 6.0 deprecates `baseUrl` (error TS5101); `paths` resolve relative to the tsconfig since TS 5.0, so it is no longer needed.
- **`@types/node` added to `packages/zk-shared`** + `types: ["node"]` — the plan's parity test imports `node:fs`/`node:path` and uses `__dirname` but the package declared no Node types, failing typecheck.
- **`boolish.default(true)`** (not `"true"`) in `env.ts` — Zod 4's `.default()` after a `.transform()` is output-typed (boolean), not input-typed.
