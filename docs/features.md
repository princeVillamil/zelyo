# Zelyo — shipped features log

A running, append-only log of shipped changes. Newest entries on top.

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
