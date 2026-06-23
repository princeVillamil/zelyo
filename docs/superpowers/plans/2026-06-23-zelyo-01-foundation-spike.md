# Phase 0 — Foundation & ZK Feasibility Spike

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> This is one phase of the Zelyo build. Read `docs/superpowers/plans/2026-06-23-zelyo-00-index.md` first — its **Global Constraints** and **Cross-Phase Interface Contract** govern every task here and are NOT redefined below. When a task references a contract name (`FieldHex`, `ProofBundle`, `ZK_VERIFY_MODE`, env keys), use the index's definition verbatim.

**Goal:** Stand up the pnpm monorepo, the dockerized dev stack (postgres/redis/minio), the typed env loader, and the documented toolchain; then run the central feasibility spike (minimal Merkle+nullifier Noir circuit → bb.js proof → Soroban testnet verification) to decide `ZK_VERIFY_MODE` (Path A on-chain vs Path B server), and stand up the Poseidon parity test rig.

**Prerequisites:** none

**Gate:** `pnpm install` succeeds from a clean clone; `docker compose up -d` brings postgres, redis, minio, and the `zelyo` bucket up healthy; `pnpm --filter @zelyo/web typecheck` passes (env schema compiles); the spike script runs end-to-end and emits a written verdict (`onchain` or `server`); `docs/superpowers/decisions/zk-verify-mode.md` records the decision and `ZK_VERIFY_MODE` is set in `.env.example`; the Poseidon parity Vitest rig runs in `packages/zk-shared` (the locked vector is present, marked pending until Phase 1 supplies real builders).

## Global Constraints

See `docs/superpowers/plans/2026-06-23-zelyo-00-index.md` → **Global Constraints**. The load-bearing values for Phase 0:

- Node.js ≥ 22 LTS · pnpm 10.x · TypeScript 6.0.x (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) · Zod 4.x · Vitest 4.x.
- Noir 1.0.0-beta.22 (`nargo` via `noirup`) · `@noir-lang/noir_js` + `@noir-lang/noir_wasm` beta.22 · `@aztec/bb.js` 4.3.x · `@stellar/stellar-sdk` 16.x · Rust `soroban-sdk` latest + Stellar CLI latest.
- **Rust 1.91.0 has known wasm build issues and is blocked by the Stellar CLI** (AGENT.md §8) — pin Rust **1.90.0** for contract builds (Task 6/7).
- MERKLE_DEPTH = 20.
- No secret carries `NEXT_PUBLIC_`. `ISSUER_SECRET` is server-only. Verify every pinned version with `pnpm view <pkg> version` before pinning.
- Parse `process.env` once through a typed Zod schema in `apps/web/src/lib/env.ts`; fail fast on boot. New env vars go in `.env.example` **and** `env.ts`.
- Conventional Commits. The full `.env.example` key list is the index's **Env keys** block.

---

## File Structure

This phase creates the skeleton. Each file's responsibility:

- `package.json`, `pnpm-workspace.yaml` — workspace root + the SPEC §14 script set.
- `.npmrc`, `.gitignore`, `.nvmrc`, `tsconfig.base.json` — toolchain pins shared across packages.
- `docker-compose.yml` — postgres 16, redis 7, minio + `createbuckets` init (SPEC §14).
- `.env.example` — full env key list (index §Env keys); committed. `.env` is gitignored.
- `apps/web/` — minimal Next.js-shaped package whose only Phase-0 content is `src/lib/env.ts` (typed Zod env loader) + its config/test. The full app lands in Phase 3.
- `packages/zk-shared/` — TS package; Phase 0 stands up only the Poseidon parity Vitest rig + locked vector fixture. Real builders land in Phase 1.
- `circuits/zelyo_credential/` — Noir package; Phase 0 ships only the **spike** circuit (Merkle inclusion + nullifier, no disclosure/binding). The full circuit lands in Phase 1.
- `contracts/credential_registry/` — Phase-2 home; left as a placeholder directory in Phase 0.
- `spike/` — throwaway spike harness (Node proof script + throwaway Soroban verifier contract + runner). Not part of the shipped product; deleted or archived after the decision is recorded.
- `docs/superpowers/decisions/zk-verify-mode.md` — the decision-gate record.

---

### Task 1: Workspace root scaffold + scripts

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.npmrc`
- Create: `.nvmrc`
- Create: `.gitignore`
- Create: `tsconfig.base.json`

**Interfaces:**
- Consumes: nothing.
- Produces: the SPEC §14 root script set (`dev build start lint typecheck test test:e2e db:migrate db:seed zk:build contracts:build contracts:deploy`); the `@zelyo/*` workspace globs every later package attaches to; `tsconfig.base.json` (the strict TS preset all packages extend).

- [ ] **Step 1: Verify toolchain versions before pinning**

Run:
```bash
node --version            # expect v22.x
corepack --version        # corepack ships with Node 22
pnpm view typescript version
pnpm view vitest version
pnpm view zod version
```
Expected: Node prints `v22.*`; `pnpm view` prints the current latest (TypeScript ≥ 6.0.x, Vitest ≥ 4.x, Zod ≥ 4.x). Pin the exact printed minors below.

- [ ] **Step 2: Create `.nvmrc`**

```
22
```

- [ ] **Step 3: Create `.npmrc`** (deterministic installs, hoist what tooling needs)

```
engine-strict=true
auto-install-peers=true
```

- [ ] **Step 4: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

> `circuits/*` and `contracts/*` are not JS packages and stay out of the pnpm workspace. The `spike/` harness is added to the workspace temporarily by Task 5 if needed; otherwise it is a standalone script run with `node`.

- [ ] **Step 5: Create `tsconfig.base.json`** (the strict preset; Global Constraints)

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "resolveJsonModule": true
  }
}
```

- [ ] **Step 6: Create root `package.json`** (SPEC §14 scripts; pin pnpm via `packageManager`)

Use the exact pnpm 10.x version printed by `pnpm --version` in the `packageManager` field.

```json
{
  "name": "zelyo",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.0.0",
  "engines": {
    "node": ">=22",
    "pnpm": ">=10"
  },
  "scripts": {
    "dev": "pnpm --filter @zelyo/web dev",
    "build": "pnpm --filter @zelyo/web build",
    "start": "pnpm --filter @zelyo/web start",
    "lint": "pnpm -r --if-present lint",
    "typecheck": "pnpm -r --if-present typecheck",
    "test": "pnpm -r --if-present test",
    "test:e2e": "pnpm --filter @zelyo/web --if-present test:e2e",
    "db:migrate": "pnpm --filter @zelyo/web --if-present db:migrate",
    "db:seed": "pnpm --filter @zelyo/web --if-present db:seed",
    "zk:build": "pnpm --filter @zelyo/web --if-present zk:build",
    "contracts:build": "bash scripts/contracts-build.sh",
    "contracts:deploy": "bash scripts/contracts-deploy.sh"
  },
  "devDependencies": {
    "typescript": "6.0.0"
  }
}
```

> Replace `pnpm@10.0.0` and `typescript@6.0.0` with the exact versions printed in Step 1. `contracts:build` / `contracts:deploy` point at scripts created in Phase 2; create the `scripts/` directory now with a stub so the command resolves (next step).

- [ ] **Step 7: Create placeholder contract scripts so root commands resolve**

Create `scripts/contracts-build.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
echo "contracts:build is implemented in Phase 2 — see contracts/credential_registry"
exit 0
```
Create `scripts/contracts-deploy.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
echo "contracts:deploy is implemented in Phase 2 — see contracts/credential_registry"
exit 0
```
Then: `chmod +x scripts/contracts-build.sh scripts/contracts-deploy.sh`

- [ ] **Step 8: Create `.gitignore`**

```
node_modules/
.pnpm-store/
dist/
.next/
.env
.env.local
*.log
coverage/
target/
circuits/**/target/
spike/**/target/
.DS_Store
```

- [ ] **Step 9: Install and verify the workspace resolves**

Run:
```bash
corepack enable
pnpm install
```
Expected: install completes with no `ERR_PNPM` errors; a `pnpm-lock.yaml` is written at the root. (`pnpm -r ... --if-present` scripts are no-ops until later packages exist — that is intentional.)

- [ ] **Step 10: Verify the script surface exists**

Run: `pnpm run`
Expected: lists all twelve scripts (`dev build start lint typecheck test test:e2e db:migrate db:seed zk:build contracts:build contracts:deploy`).

- [ ] **Step 11: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc .nvmrc .gitignore tsconfig.base.json scripts/contracts-build.sh scripts/contracts-deploy.sh
git commit -m "chore: scaffold pnpm workspace root with SPEC scripts"
```

---

### Task 2: Dev stack — docker-compose (postgres 16, redis 7, minio + bucket)

**Files:**
- Create: `docker-compose.yml`

**Interfaces:**
- Consumes: the connection values in `.env.example` (Task 4): `DATABASE_URL` (postgres `zelyo:zelyo@localhost:5432/zelyo`), `REDIS_URL` (`localhost:6379`), `S3_*` (minio `localhost:9000`, creds `minioadmin`, bucket `zelyo`).
- Produces: a healthy local stack so every later phase's `docker compose up -d` "just works" (SPEC §13 criterion 5, §14).

- [ ] **Step 1: Create `docker-compose.yml`** (SPEC §14 services + minio bucket init)

```yaml
services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: zelyo
      POSTGRES_PASSWORD: zelyo
      POSTGRES_DB: zelyo
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U zelyo -d zelyo"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7
    restart: unless-stopped
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 10

  minio:
    image: minio/minio:latest
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 5s
      timeout: 5s
      retries: 10

  createbuckets:
    image: minio/mc:latest
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      mc alias set local http://minio:9000 minioadmin minioadmin;
      mc mb --ignore-existing local/zelyo;
      echo 'bucket zelyo ready';
      exit 0;
      "

volumes:
  postgres_data:
  minio_data:
```

- [ ] **Step 2: Bring the stack up**

Run: `docker compose up -d`
Expected: `postgres`, `redis`, `minio` start; `createbuckets` runs once and exits `0` printing `bucket zelyo ready`.

- [ ] **Step 3: Verify each service is healthy**

Run: `docker compose ps`
Expected: `postgres`, `redis`, `minio` show `healthy`; `createbuckets` shows `exited (0)`.

- [ ] **Step 4: Verify the bucket exists**

Run:
```bash
docker compose run --rm createbuckets /bin/sh -c "mc alias set local http://minio:9000 minioadmin minioadmin && mc ls local/"
```
Expected: output lists `zelyo/`.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: add dev stack (postgres 16, redis 7, minio + zelyo bucket)"
```

---

### Task 3: `.env.example` (full key list)

**Files:**
- Create: `.env.example`

**Interfaces:**
- Consumes: nothing.
- Produces: the canonical env contract that `apps/web/src/lib/env.ts` (Task 4) parses; the index's **Env keys** block is the authoritative list. `ZK_VERIFY_MODE` is written here now (default placeholder) and finalized by the decision gate (Task 6).

- [ ] **Step 1: Create `.env.example`** (exact key list from the index + SPEC §12; no secret carries `NEXT_PUBLIC_`)

```bash
# Core
NODE_ENV=development
APP_URL=http://localhost:3000
LOG_LEVEL=info

# Auth.js
AUTH_SECRET=                      # openssl rand -base64 48
AUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true

# Database (Railway Postgres in prod; docker-compose locally)
DATABASE_URL=postgresql://zelyo:zelyo@localhost:5432/zelyo?schema=public
DIRECT_URL=postgresql://zelyo:zelyo@localhost:5432/zelyo?schema=public

# Redis
REDIS_URL=redis://localhost:6379

# Object storage (dev=MinIO, prod=Railway bucket; S3 API)
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=zelyo
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_FORCE_PATH_STYLE=true

# Stellar / Soroban (testnet)
STELLAR_NETWORK=testnet
NETWORK_PASSPHRASE=Test SDF Network ; September 2015
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
HORIZON_URL=https://horizon-testnet.stellar.org
ISSUER_SECRET=                    # S... server-only signer for set_root + deploy. NEVER expose to client
CREDENTIAL_REGISTRY_CONTRACT_ID=
VERIFIER_CONTRACT_ID=

# ZK
ZK_SCOPE_APP_ID=zelyo-v1          # folded into scope = Hash(app_id|chain_id|registry_id)
ZK_VERIFY_MODE=onchain            # onchain (Path A) | server (Path B). Set by the Phase 0 decision gate.
CIRCUIT_ARTIFACT_BASE=/circuit    # served from apps/web/public/circuit

# Seed (admin + issuer)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=                    # strong; set per environment
ISSUER_NAME=Institute of Distributed Systems
ISSUER_STELLAR_ACCOUNT=

# Public (non-secret client config only)
NEXT_PUBLIC_EXPLORER_BASE=https://stellar.expert/explorer/testnet
```

- [ ] **Step 2: Verify the key set matches the contract**

Run:
```bash
grep -oE '^[A-Z_]+=' .env.example | sed 's/=$//' | sort
```
Expected: includes every key from the index's **Env keys** block — `APP_URL LOG_LEVEL AUTH_SECRET AUTH_URL AUTH_TRUST_HOST DATABASE_URL DIRECT_URL REDIS_URL S3_ENDPOINT S3_REGION S3_BUCKET S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY S3_FORCE_PATH_STYLE STELLAR_NETWORK NETWORK_PASSPHRASE SOROBAN_RPC_URL HORIZON_URL ISSUER_SECRET CREDENTIAL_REGISTRY_CONTRACT_ID VERIFIER_CONTRACT_ID ZK_SCOPE_APP_ID ZK_VERIFY_MODE CIRCUIT_ARTIFACT_BASE ADMIN_USERNAME ADMIN_PASSWORD ISSUER_NAME ISSUER_STELLAR_ACCOUNT NEXT_PUBLIC_EXPLORER_BASE` — plus `NODE_ENV`.

- [ ] **Step 3: Verify no secret carries `NEXT_PUBLIC_`**

Run: `grep -E '^NEXT_PUBLIC_' .env.example`
Expected: exactly one line — `NEXT_PUBLIC_EXPLORER_BASE=...`. No `AUTH_SECRET`, `ISSUER_SECRET`, `S3_SECRET_ACCESS_KEY`, or `ADMIN_PASSWORD` among them.

- [ ] **Step 4: Create a local `.env` from the example**

Run: `cp .env.example .env`
Expected: `.env` exists and is gitignored (Task 1 Step 8 added it).

- [ ] **Step 5: Commit**

```bash
git add .env.example
git commit -m "chore: add .env.example with full Zelyo env key list"
```

---

### Task 4: Typed env loader — `apps/web/src/lib/env.ts` (Zod, fail-fast)

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/lib/env.ts`
- Test: `apps/web/src/lib/env.test.ts`

**Interfaces:**
- Consumes: `.env.example` keys (Task 3).
- Produces: `import { env } from "@/lib/env"` — a frozen, typed object validated once at module load. `parseEnv(raw: Record<string, string | undefined>): Env` (pure, exported for tests). `type Env` is the inferred Zod output. Later phases import `env` instead of touching `process.env`.

- [ ] **Step 1: Create `apps/web/package.json`** (minimal; the full Next.js app deps arrive in Phase 3)

Pin Zod and Vitest to the versions printed by `pnpm view` in Task 1 Step 1.

```json
{
  "name": "@zelyo/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "lint": "echo \"lint configured in Phase 3\" && exit 0"
  },
  "dependencies": {
    "zod": "4.0.0"
  },
  "devDependencies": {
    "typescript": "6.0.0",
    "vitest": "4.0.0",
    "@types/node": "22.0.0"
  }
}
```

> Replace each version with the exact value from `pnpm view <pkg> version`. `@types/node` tracks the Node 22 line.

- [ ] **Step 2: Create `apps/web/tsconfig.json`** (extends the strict base; `@/` path alias)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "types": ["node"],
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `apps/web/vitest.config.ts`** (resolve the `@/` alias in tests)

```ts
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Write the failing test**

`apps/web/src/lib/env.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

const valid = {
  NODE_ENV: "development",
  APP_URL: "http://localhost:3000",
  LOG_LEVEL: "info",
  AUTH_SECRET: "x".repeat(32),
  AUTH_URL: "http://localhost:3000",
  AUTH_TRUST_HOST: "true",
  DATABASE_URL: "postgresql://zelyo:zelyo@localhost:5432/zelyo?schema=public",
  DIRECT_URL: "postgresql://zelyo:zelyo@localhost:5432/zelyo?schema=public",
  REDIS_URL: "redis://localhost:6379",
  S3_ENDPOINT: "http://localhost:9000",
  S3_REGION: "us-east-1",
  S3_BUCKET: "zelyo",
  S3_ACCESS_KEY_ID: "minioadmin",
  S3_SECRET_ACCESS_KEY: "minioadmin",
  S3_FORCE_PATH_STYLE: "true",
  STELLAR_NETWORK: "testnet",
  NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  SOROBAN_RPC_URL: "https://soroban-testnet.stellar.org",
  HORIZON_URL: "https://horizon-testnet.stellar.org",
  ISSUER_SECRET: "SABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRST",
  CREDENTIAL_REGISTRY_CONTRACT_ID: "",
  VERIFIER_CONTRACT_ID: "",
  ZK_SCOPE_APP_ID: "zelyo-v1",
  ZK_VERIFY_MODE: "onchain",
  CIRCUIT_ARTIFACT_BASE: "/circuit",
  ADMIN_USERNAME: "admin",
  ADMIN_PASSWORD: "supersecret-password",
  ISSUER_NAME: "Institute of Distributed Systems",
  ISSUER_STELLAR_ACCOUNT: "",
  NEXT_PUBLIC_EXPLORER_BASE: "https://stellar.expert/explorer/testnet",
};

describe("parseEnv", () => {
  it("parses a complete valid environment", () => {
    const env = parseEnv(valid);
    expect(env.ZK_VERIFY_MODE).toBe("onchain");
    expect(env.S3_FORCE_PATH_STYLE).toBe(true);
    expect(env.AUTH_TRUST_HOST).toBe(true);
  });

  it("coerces S3_FORCE_PATH_STYLE and AUTH_TRUST_HOST to booleans", () => {
    const env = parseEnv({ ...valid, S3_FORCE_PATH_STYLE: "false", AUTH_TRUST_HOST: "false" });
    expect(env.S3_FORCE_PATH_STYLE).toBe(false);
    expect(env.AUTH_TRUST_HOST).toBe(false);
  });

  it("rejects an AUTH_SECRET shorter than 32 chars", () => {
    expect(() => parseEnv({ ...valid, AUTH_SECRET: "short" })).toThrow();
  });

  it("rejects an unknown ZK_VERIFY_MODE", () => {
    expect(() => parseEnv({ ...valid, ZK_VERIFY_MODE: "magic" })).toThrow();
  });

  it("rejects a non-URL DATABASE_URL", () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL: "not-a-url" })).toThrow();
  });
});
```

- [ ] **Step 5: Run the test to confirm it fails**

Run: `pnpm --filter @zelyo/web test`
Expected: FAIL — `Cannot find module '@/lib/env'` (env.ts not created yet).

- [ ] **Step 6: Write the minimal implementation**

`apps/web/src/lib/env.ts`:
```ts
import { z } from "zod";

const boolish = z
  .enum(["true", "false"])
  .transform((v) => v === "true");

const optionalString = z.string().optional().default("");

const EnvSchema = z.object({
  // Core
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  // Auth.js
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be >= 32 chars"),
  AUTH_URL: z.string().url(),
  AUTH_TRUST_HOST: boolish.default("true"),

  // Database
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url(),

  // Object storage
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: boolish.default("true"),

  // Stellar / Soroban
  STELLAR_NETWORK: z.enum(["testnet", "futurenet", "mainnet"]).default("testnet"),
  NETWORK_PASSPHRASE: z.string().min(1),
  SOROBAN_RPC_URL: z.string().url(),
  HORIZON_URL: z.string().url(),
  ISSUER_SECRET: z.string().min(1),
  CREDENTIAL_REGISTRY_CONTRACT_ID: optionalString,
  VERIFIER_CONTRACT_ID: optionalString,

  // ZK
  ZK_SCOPE_APP_ID: z.string().min(1),
  ZK_VERIFY_MODE: z.enum(["onchain", "server"]),
  CIRCUIT_ARTIFACT_BASE: z.string().min(1).default("/circuit"),

  // Seed
  ADMIN_USERNAME: z.string().min(1),
  ADMIN_PASSWORD: z.string().min(8),
  ISSUER_NAME: z.string().min(1),
  ISSUER_STELLAR_ACCOUNT: optionalString,

  // Public
  NEXT_PUBLIC_EXPLORER_BASE: z.string().url(),
});

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = EnvSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return Object.freeze(result.data);
}

export const env: Env = parseEnv(process.env as Record<string, string | undefined>);
```

> Note: this module is imported anywhere `env` is needed. In Phase 3 it gains `import "server-only";` once the Next.js runtime exists; in Phase 0 the package has no `server-only` dependency yet, so it is omitted. The `parseEnv` export keeps the validation logic unit-testable without booting the app.

- [ ] **Step 7: Run the test to confirm it passes**

Run: `pnpm --filter @zelyo/web test`
Expected: PASS — all five `parseEnv` cases green.

- [ ] **Step 8: Typecheck**

Run: `pnpm --filter @zelyo/web typecheck`
Expected: no errors (strict TS, the env schema and `Env` type compile).

- [ ] **Step 9: Commit**

```bash
git add apps/web/package.json apps/web/tsconfig.json apps/web/vitest.config.ts apps/web/src/lib/env.ts apps/web/src/lib/env.test.ts pnpm-lock.yaml
git commit -m "feat(web): add fail-fast typed Zod env loader"
```

---

### Task 5: Toolchain install runbook (documented, not automated)

**Files:**
- Create: `docs/toolchain.md`

**Interfaces:**
- Consumes: nothing.
- Produces: a single reference the spike (Task 6) and Phases 1–2 follow to install `nargo`, `bb`, Rust + `soroban-sdk`, and the Stellar CLI at the exact pinned versions. Records the **Rust 1.90.0** pin (AGENT.md §8).

- [ ] **Step 1: Create `docs/toolchain.md`** with the verbatim install commands

````markdown
# Zelyo local toolchain (Phase 0)

These tools live outside the pnpm workspace and are installed once per machine.
Versions are pinned per Global Constraints. Re-verify availability before use.

## 1. Noir (nargo 1.0.0-beta.22) + Barretenberg (bb)

```bash
# install noirup (the Noir toolchain manager)
curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
# new shell, then pin the exact version
noirup --version 1.0.0-beta.22
nargo --version            # expect: nargo version = 1.0.0-beta.22

# install Barretenberg's bb CLI (proving backend, UltraHonk)
curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/master/barretenberg/bbup/install | bash
# new shell, then install the bb that pairs with bb.js 4.3.x
bbup --version 0.x          # pin to the bb release matching @aztec/bb.js 4.3.x (check the bb.js release notes)
bb --version
```

The JS proving libs (`@noir-lang/noir_js`, `@noir-lang/noir_wasm` beta.22,
`@aztec/bb.js` 4.3.x) are pnpm dependencies, added by the spike (Task 6) and Phase 1 — not installed here.

## 2. Rust + soroban-sdk (PIN Rust 1.90.0)

AGENT.md §8: **Rust 1.91.0 has wasm build issues and is blocked by the Stellar CLI.**
Pin a compatible toolchain for contract builds.

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# new shell
rustup toolchain install 1.90.0
rustup default 1.90.0
rustup target add wasm32-unknown-unknown   # soroban contracts compile to wasm
rustc --version                              # expect: rustc 1.90.0
```

Pin the toolchain in the repo so contract builds are reproducible — create
`rust-toolchain.toml` at the contracts root in Phase 2:

```toml
[toolchain]
channel = "1.90.0"
targets = ["wasm32-unknown-unknown"]
```

`soroban-sdk` is a Cargo dependency declared in each contract's `Cargo.toml`
(Phase 2), pinned to the latest release compatible with the testnet protocol.

## 3. Stellar CLI (latest)

```bash
cargo install --locked stellar-cli       # or: brew install stellar-cli
stellar --version
```

`stellar contract build` optimizes wasm by default (AGENT.md §8) — do NOT pass `--optimize`.

## 4. Testnet account funding (Friendbot, dev only)

```bash
# generate a throwaway testnet keypair
stellar keys generate --network testnet spike
stellar keys address spike                # prints the G... public key
# fund it
stellar keys fund spike --network testnet
# (equivalently) curl "https://friendbot.stellar.org/?addr=<G_ADDRESS>"
```
````

- [ ] **Step 2: Sanity-check the doc renders and links are plain**

Run: `wc -l docs/toolchain.md`
Expected: a non-empty file (> 40 lines). Open it and confirm the four sections are present.

- [ ] **Step 3: Commit**

```bash
git add docs/toolchain.md
git commit -m "docs: add Phase 0 toolchain install runbook (nargo, bb, rust 1.90, stellar cli)"
```

---

### Task 6: THE SPIKE — minimal circuit → bb.js proof → on-chain verify attempt → decision gate

**Files:**
- Create: `circuits/zelyo_credential/Nargo.toml`
- Create: `circuits/zelyo_credential/src/main.nr` (spike circuit: Merkle inclusion + nullifier ONLY)
- Create: `spike/package.json`
- Create: `spike/tsconfig.json`
- Create: `spike/generate-proof.ts` (Node: execute circuit, generate UltraHonk proof + VK via bb.js)
- Create: `spike/verifier/` (throwaway Soroban contract that attempts on-chain proof verification)
- Create: `spike/verify-onchain.ts` (deploy throwaway verifier to testnet, submit proof, capture verdict)
- Create: `spike/README.md`
- Create: `docs/superpowers/decisions/zk-verify-mode.md` (the decision-gate record)
- Modify: `.env.example` (finalize `ZK_VERIFY_MODE`)

**Interfaces:**
- Consumes: the toolchain from Task 5 (`nargo`, `bb`, Rust 1.90.0, Stellar CLI); a Friendbot-funded testnet account.
- Produces: a written verdict that sets `ZK_VERIFY_MODE` to `onchain` (Path A) or `server` (Path B) per design §2; this value flows into every later phase via the index's Path A/B contract. The spike artifacts are throwaway — the real circuit (Phase 1) and real `CredentialRegistry` (Phase 2) supersede them.

> This task is a **spike**: its deliverable is a decision, not production code. TDD does not apply to throwaway exploration; the "test" is the on-chain verification attempt and the verdict it produces. Keep everything under `spike/` so it is trivially deletable.

- [ ] **Step 1: Create the spike Noir package manifest**

`circuits/zelyo_credential/Nargo.toml`:
```toml
[package]
name = "zelyo_credential"
type = "bin"
authors = ["Zelyo"]
compiler_version = ">=1.0.0-beta.22"

[dependencies]
```

> This is the spike form of the package. Phase 1 replaces `src/main.nr` with the full circuit (disclosure + address binding + range/date predicate) but keeps this manifest.

- [ ] **Step 2: Write the spike circuit (Merkle inclusion + nullifier ONLY — no disclosure, no binding)**

`circuits/zelyo_credential/src/main.nr`:
```rust
// Phase 0 spike circuit. Proves Merkle inclusion of a leaf derived from the
// holder secret `s`, and outputs nullifier = Poseidon([s, scope]).
// NO selective disclosure, NO address binding — those land in Phase 1.
// Fixed depth 4 keeps the spike fast; the production circuit uses depth 20.

use std::hash::poseidon;

global SPIKE_DEPTH: u32 = 4;

fn main(
    s: Field,                                   // private: holder secret
    merkle_path: [Field; SPIKE_DEPTH],          // private: sibling hashes
    path_indices: [u1; SPIKE_DEPTH],            // private: 0 = current is left, 1 = right
    root: pub Field,                            // public: published Merkle root
    scope: pub Field,                           // public: Hash(app_id|chain_id|registry_id)
    nullifier: pub Field,                       // public: output, asserted below
) {
    // leaf = Poseidon(Poseidon(s)) for the spike (single attribute slot omitted)
    let id_commitment = poseidon::bn254::hash_1([s]);
    let mut node = poseidon::bn254::hash_1([id_commitment]);

    for i in 0..SPIKE_DEPTH {
        let sibling = merkle_path[i];
        let is_right = path_indices[i] as Field;
        // if is_right == 0: node is left child; else node is right child
        let left = node * (1 - is_right) + sibling * is_right;
        let right = sibling * (1 - is_right) + node * is_right;
        node = poseidon::bn254::hash_2([left, right]);
    }

    assert(node == root);
    assert(nullifier == poseidon::bn254::hash_2([s, scope]));
}
```

> If `std::hash::poseidon::bn254::hash_N` signatures differ in beta.22, adjust to the actual API printed by `nargo` — the spike's purpose is feasibility, and the exact Poseidon parameterization is locked properly in Phase 1.

- [ ] **Step 3: Compile the circuit**

Run:
```bash
cd circuits/zelyo_credential
nargo compile
ls target/
```
Expected: `nargo compile` succeeds; `target/zelyo_credential.json` (ACIR + ABI) exists.

- [ ] **Step 4: Create the spike Node proof harness**

`spike/package.json`:
```json
{
  "name": "zelyo-spike",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "proof": "node --import tsx generate-proof.ts",
    "onchain": "node --import tsx verify-onchain.ts"
  },
  "dependencies": {
    "@noir-lang/noir_js": "1.0.0-beta.22",
    "@noir-lang/noir_wasm": "1.0.0-beta.22",
    "@aztec/bb.js": "4.3.0",
    "@stellar/stellar-sdk": "16.0.0"
  },
  "devDependencies": {
    "tsx": "4.0.0",
    "typescript": "6.0.0"
  }
}
```

> Replace each version with the exact value from `pnpm view <pkg> version` (and the `@aztec/bb.js` minor that matches the installed `bb`). `spike/` is standalone — install its deps with `pnpm --dir spike install --ignore-workspace` (or `npm install` inside `spike/`) so the throwaway harness does not pollute the root lockfile.

`spike/tsconfig.json`:
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": ".",
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["*.ts"]
}
```

- [ ] **Step 5: Write the proof-generation script**

`spike/generate-proof.ts`:
```ts
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Noir } from "@noir-lang/noir_js";
import { UltraHonkBackend } from "@aztec/bb.js";

const ARTIFACT = resolve(
  import.meta.dirname,
  "../circuits/zelyo_credential/target/zelyo_credential.json",
);

// Fixed spike vectors. These match a tiny depth-4 tree the script builds inline.
// The point is feasibility, not a real tree — Phase 4 owns the real Merkle service.
async function main() {
  const circuit = JSON.parse(await readFile(ARTIFACT, "utf8"));
  const noir = new Noir(circuit);
  const backend = new UltraHonkBackend(circuit.bytecode);

  // Spike inputs: caller fills s/path/root/scope/nullifier consistent with the
  // circuit's Poseidon (computed via a throwaway nargo `execute` or a tiny JS
  // poseidon-bn254 helper). For the spike, derive them by running `nargo execute`
  // with a Prover.toml and reading the witness, OR hardcode a self-consistent set.
  const inputs = JSON.parse(
    await readFile(resolve(import.meta.dirname, "spike-inputs.json"), "utf8"),
  );

  const { witness } = await noir.execute(inputs);
  const proof = await backend.generateProof(witness);
  const vk = await backend.getVerificationKey();

  // local sanity: bb.js verifies its own proof
  const ok = await backend.verifyProof(proof);
  console.log("[spike] local bb.js verifyProof =", ok);

  await writeFile(
    resolve(import.meta.dirname, "proof.json"),
    JSON.stringify(
      {
        proof: Buffer.from(proof.proof).toString("hex"),
        publicInputs: proof.publicInputs,
        vk: Buffer.from(vk).toString("hex"),
      },
      null,
      2,
    ),
  );
  console.log("[spike] wrote proof.json + vk");
  await backend.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

> To produce `spike-inputs.json`, run `nargo execute` with a `Prover.toml` of self-consistent fixed values (nargo computes the witness and reports the public `nullifier`/`root` it derives) and transcribe them — this guarantees the JS inputs satisfy the circuit. The script is exploratory; if a bb.js API name differs in 4.3.x, follow the installed package's `.d.ts`.

- [ ] **Step 6: Generate the proof locally**

Run:
```bash
cd spike
pnpm --dir . install --ignore-workspace
pnpm proof
```
Expected: prints `[spike] local bb.js verifyProof = true` and writes `spike/proof.json`. **If proving fails locally, that is itself a finding** — record it in the decision doc; on-chain verification cannot beat a failing local proof.

- [ ] **Step 7: Create the throwaway Soroban verifier contract**

`spike/verifier/` is a minimal Rust soroban contract whose single job is to call the testnet protocol's BN254/Poseidon host functions (or a reused UltraHonk verifier) on the spike proof + VK + public inputs and return a `bool`. Scaffold it:

```bash
cd spike
stellar contract init verifier --name spike_verifier
```

Edit `spike/verifier/contracts/spike_verifier/src/lib.rs` to expose:
```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, Bytes, BytesN, Env, Vec};

#[contract]
pub struct SpikeVerifier;

#[contractimpl]
impl SpikeVerifier {
    /// Attempts to verify an UltraHonk proof using the host's BN254 pairing +
    /// Poseidon functions (or a reused verifier). Returns true if the proof
    /// verifies. The body wires up whatever verification primitive the current
    /// testnet protocol exposes; if none exists, this contract WILL NOT BUILD
    /// or WILL revert — that outcome is the Path B signal.
    pub fn verify(env: Env, proof: Bytes, vk: Bytes, public_inputs: Vec<BytesN<32>>) -> bool {
        // EXPLORATORY: bind to the available host crypto function(s).
        // The spike succeeds (Path A) only if a real verification path compiles,
        // deploys, and returns true for a valid proof on testnet.
        let _ = (&proof, &vk, &public_inputs);
        env.crypto(); // touchpoint: investigate available pairing/poseidon host fns here
        false
    }
}
```

> The `verify` body is the crux of the spike: investigate what the **current testnet protocol** exposes (BN254 pairing, Poseidon) and whether a reused UltraHonk verifier can be deployed. If the primitives are absent or the contract cannot perform a real verification, the spike fails → Path B.

- [ ] **Step 8: Build the throwaway verifier with the pinned Rust**

Run:
```bash
cd spike/verifier
rustup override set 1.90.0
stellar contract build
ls target/wasm32-unknown-unknown/release/
```
Expected: build succeeds and emits an optimized `spike_verifier.wasm`. **If the build fails due to missing host functions, record it as the Path B signal** and skip to Step 11.

- [ ] **Step 9: Deploy to testnet and attempt on-chain verification**

`spike/verify-onchain.ts`:
```ts
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

// Reads spike/proof.json, invokes the deployed spike_verifier.verify on testnet
// via @stellar/stellar-sdk, and prints the on-chain verdict.
async function main() {
  const { proof, publicInputs, vk } = JSON.parse(
    await readFile(resolve(import.meta.dirname, "proof.json"), "utf8"),
  );
  console.log("[spike] proof bytes:", proof.length / 2);
  console.log("[spike] publicInputs:", publicInputs);
  console.log("[spike] vk bytes:", vk.length / 2);
  // Use the Stellar CLI for deploy + invoke (simplest for a spike):
  //   stellar contract deploy --wasm spike/verifier/target/.../spike_verifier.wasm \
  //     --source spike --network testnet           -> CONTRACT_ID
  //   stellar contract invoke --id CONTRACT_ID --source spike --network testnet \
  //     -- verify --proof <hex> --vk <hex> --public_inputs '[...]'
  // Capture the boolean result and whether the tx succeeded vs reverted.
  console.log("[spike] follow spike/README.md for the deploy+invoke commands");
}

main().catch((e) => { console.error(e); process.exit(1); });
```

Run (using the funded `spike` account from Task 5 Step 4):
```bash
cd spike/verifier
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/spike_verifier.wasm \
  --source spike --network testnet
# -> capture CONTRACT_ID, then:
stellar contract invoke --id <CONTRACT_ID> --source spike --network testnet \
  -- verify --proof <PROOF_HEX> --vk <VK_HEX> --public_inputs '<JSON_ARRAY>'
```
Expected: either (Path A) the invoke returns `true` for the valid proof and a tx is recorded on testnet, OR (Path B) the deploy/invoke fails / returns `false` because the protocol cannot verify the proof on-chain today.

- [ ] **Step 10: Write the spike README capturing exact commands + raw outputs**

`spike/README.md`: record the exact `nargo compile`, `pnpm proof`, `stellar contract build`, `deploy`, and `invoke` commands actually run, plus their raw output (local `verifyProof`, build result, on-chain verdict + tx hash or error). This is the evidence the decision cites.

- [ ] **Step 11: Decide and record the verdict (THE DECISION GATE)**

Apply the rule from design §2:
- **Path A (`onchain`)** if a throwaway Soroban contract built, deployed to testnet, and returned `true` verifying a valid UltraHonk proof (and `false`/revert for an invalid one).
- **Path B (`server`)** otherwise — the host primitives are absent, the verifier cannot be deployed, or verification does not pass on-chain today.

Create `docs/superpowers/decisions/zk-verify-mode.md`:
```markdown
# Decision: ZK_VERIFY_MODE (Path A vs Path B)

**Date:** 2026-06-23
**Phase:** 0 — Foundation & ZK feasibility spike
**Decision driver:** design doc §2 (the central risk and its fallback).

## Outcome

`ZK_VERIFY_MODE = <onchain | server>`   <!-- fill from the spike result -->

## Evidence (from spike/README.md)

- nargo compile: <result>
- bb.js local verifyProof: <true|false>
- spike_verifier build (Rust 1.90.0): <ok | failed: reason>
- testnet deploy: <CONTRACT_ID | failed: reason>
- on-chain verify(valid proof): <true | false | revert: reason>
- tx hash: <hash | n/a>

## Consequence

- Path A: `CredentialRegistry.verify_and_register` verifies the proof on-chain (Phase 2/5).
- Path B: server verifies via bb.js/`nargo verify`; `CredentialRegistry.register`
  records the server-attested nullifier + root on-chain (Phase 2/5).
- Either way, all `SPEC.md §13` acceptance reveals hold; only the verification
  location differs. Phases 4–7 program against the `verifyAndRegister` service interface.
```

- [ ] **Step 12: Finalize `ZK_VERIFY_MODE` in `.env.example`**

Edit `.env.example` so the `ZK_VERIFY_MODE=` value reflects the decision (`onchain` for Path A, `server` for Path B). Mirror it in your local `.env`.

- [ ] **Step 13: Verify env still parses with the chosen mode**

Run: `pnpm --filter @zelyo/web test`
Expected: PASS — `parseEnv` accepts the chosen `ZK_VERIFY_MODE` value (both `onchain` and `server` are in the enum, Task 4).

- [ ] **Step 14: Commit**

```bash
git add circuits/zelyo_credential spike docs/superpowers/decisions/zk-verify-mode.md .env.example
git commit -m "feat(spike): run ZK on-chain verification spike and record ZK_VERIFY_MODE decision"
```

---

### Task 7: Poseidon parity harness skeleton (`packages/zk-shared`)

**Files:**
- Create: `packages/zk-shared/package.json`
- Create: `packages/zk-shared/tsconfig.json`
- Create: `packages/zk-shared/vitest.config.ts`
- Create: `packages/zk-shared/src/types.ts`
- Create: `packages/zk-shared/test/fixtures/parity-vectors.json`
- Test: `packages/zk-shared/test/poseidon-parity.test.ts`

**Interfaces:**
- Consumes: `FieldHex`, `Attributes`, `buildLeaf`, `computeNullifier`, `MERKLE_DEPTH` — names/signatures from the index's **`packages/zk-shared`** contract block. Phase 0 declares `FieldHex`, `Attributes`, and `MERKLE_DEPTH`; the builders are declared as `not-yet-implemented` stubs so the test rig compiles and runs.
- Produces: a running Vitest parity rig with one locked fixture vector, marked **pending** (`it.todo` / skipped with a clear reason) until Phase 1 supplies the circuit-derived expected leaf. This stands up the approach that AGENT.md §5 makes CI-blocking.

> The full builders and real expected values come in Phase 1 (where the circuit's Poseidon is finalized). Phase 0 deliverable: the rig exists, the vector file exists, the test runs (one pending case), and the type contract names are locked.

- [ ] **Step 1: Create `packages/zk-shared/package.json`**

```json
{
  "name": "@zelyo/zk-shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "lint": "echo \"lint configured in Phase 3\" && exit 0"
  },
  "devDependencies": {
    "typescript": "6.0.0",
    "vitest": "4.0.0"
  }
}
```

> Pin `typescript`/`vitest` to the versions from Task 1 Step 1.

- [ ] **Step 2: Create `packages/zk-shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": ".",
    "noEmit": true
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: Create `packages/zk-shared/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Declare the locked types + stub builders** (`packages/zk-shared/src/types.ts`)

```ts
// Cross-phase contract types. Signatures are locked here (index §zk-shared);
// the Poseidon implementation + real builders land in Phase 1.

// Field element as 0x-prefixed lowercase hex, 32 bytes. Branded for safety.
export type FieldHex = string & { readonly __brand: "FieldHex" };

export interface Attributes {
  track: string; // disclosed predicate target
  grade: string;
  issueDate: string; // ISO 8601
  courseName: string;
  learnerName: string;
}

export const MERKLE_DEPTH = 20 as const;

const NOT_YET = "implemented in Phase 1 — see 2026-06-23-zelyo-02-zk-circuit.md";

// Poseidon over BN254 — MUST match circuit params (parity-tested in Phase 1).
export function idCommitment(_s: FieldHex): FieldHex {
  throw new Error(`idCommitment ${NOT_YET}`);
}

// leaf = Poseidon(idCommitment, Poseidon(attributes))
export function buildLeaf(_idCommitment: FieldHex, _attributes: Attributes): FieldHex {
  throw new Error(`buildLeaf ${NOT_YET}`);
}

// nullifier = Poseidon(s, scope)
export function computeNullifier(_s: FieldHex, _scope: FieldHex): FieldHex {
  throw new Error(`computeNullifier ${NOT_YET}`);
}
```

> Create `packages/zk-shared/src/index.ts` re-exporting from `./types` so the package's `main` resolves: `export * from "./types";`

- [ ] **Step 5: Create the locked parity vector fixture** (`packages/zk-shared/test/fixtures/parity-vectors.json`)

```json
{
  "_comment": "Phase 0 locks the vector SHAPE. expectedLeaf is filled in Phase 1 from the circuit (nargo execute) — until then the parity test is pending.",
  "vectors": [
    {
      "name": "fixed-vector-1",
      "s": "0x0000000000000000000000000000000000000000000000000000000000000001",
      "attributes": {
        "track": "Data Engineering",
        "grade": "A",
        "issueDate": "2026-06-23",
        "courseName": "Distributed Systems",
        "learnerName": "Ada Lovelace"
      },
      "expectedLeaf": null
    }
  ]
}
```

- [ ] **Step 6: Write the parity test rig (one pending vector)** (`packages/zk-shared/test/poseidon-parity.test.ts`)

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildLeaf, idCommitment, type Attributes, type FieldHex } from "../src/index.js";

interface Vector {
  name: string;
  s: string;
  attributes: Attributes;
  expectedLeaf: string | null;
}

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, "fixtures/parity-vectors.json"), "utf8"),
) as { vectors: Vector[] };

describe("Poseidon parity (JS leaf == circuit leaf)", () => {
  for (const v of fixture.vectors) {
    if (v.expectedLeaf === null) {
      // Phase 0: rig is stood up but the circuit-derived expected value is not
      // yet available. Phase 1 fills expectedLeaf and removes this branch.
      it.todo(`${v.name}: expectedLeaf pending circuit derivation (Phase 1)`);
      continue;
    }
    it(`${v.name}: JS-computed leaf matches the circuit`, () => {
      const leaf = buildLeaf(idCommitment(v.s as FieldHex), v.attributes);
      expect(leaf).toBe(v.expectedLeaf);
    });
  }
});
```

- [ ] **Step 7: Run the rig**

Run: `pnpm --filter @zelyo/zk-shared test`
Expected: Vitest runs; reports 1 todo (`fixed-vector-1: expectedLeaf pending circuit derivation (Phase 1)`), 0 failures. The rig is live.

- [ ] **Step 8: Typecheck the package**

Run: `pnpm --filter @zelyo/zk-shared typecheck`
Expected: no errors — the locked contract types and stub builders compile under strict TS.

- [ ] **Step 9: Commit**

```bash
git add packages/zk-shared pnpm-lock.yaml
git commit -m "test(zk-shared): stand up Poseidon parity rig with locked pending vector"
```

---

### Task 8: Placeholder dirs for Phase 2 contracts + Phase 3 web, and a full-stack smoke

**Files:**
- Create: `contracts/credential_registry/.gitkeep`
- Create: `contracts/verifier/.gitkeep`
- Create: `apps/web/public/circuit/.gitkeep`

**Interfaces:**
- Consumes: everything above.
- Produces: the directory skeleton from SPEC §4 so Phases 2–3 land into the expected paths; a verified clean-clone bootstrap matching SPEC §13 criterion 5 (as far as Phase 0 reaches).

- [ ] **Step 1: Create the placeholder directories**

Run:
```bash
mkdir -p contracts/credential_registry contracts/verifier apps/web/public/circuit
touch contracts/credential_registry/.gitkeep contracts/verifier/.gitkeep apps/web/public/circuit/.gitkeep
```

- [ ] **Step 2: Verify the repo layout matches SPEC §4**

Run: `find apps packages circuits contracts -maxdepth 2 -type d | sort`
Expected: includes `apps/web`, `apps/web/public/circuit`, `apps/web/src/lib` (created in Task 4), `packages/zk-shared`, `circuits/zelyo_credential`, `contracts/credential_registry`, `contracts/verifier`.

- [ ] **Step 3: Full-stack bootstrap smoke (clean dependency state)**

Run:
```bash
pnpm install
docker compose up -d
docker compose ps
pnpm -r --if-present typecheck
pnpm -r --if-present test
```
Expected: install succeeds; all four compose services report healthy/exited(0); typecheck passes across `@zelyo/web` + `@zelyo/zk-shared`; tests pass (env loader green, parity rig reports the todo).

- [ ] **Step 4: Commit**

```bash
git add contracts/credential_registry/.gitkeep contracts/verifier/.gitkeep apps/web/public/circuit/.gitkeep
git commit -m "chore: scaffold Phase 2/3 directory skeleton per SPEC §4"
```

---

## Phase Gate

Do not start Phase 1 until **all** of these pass:

- [ ] From a clean clone, `corepack enable && pnpm install` succeeds and writes `pnpm-lock.yaml`.
- [ ] `pnpm run` lists all twelve SPEC §14 scripts.
- [ ] `docker compose up -d` brings `postgres` (16), `redis` (7), `minio` up **healthy**; `createbuckets` exits `0` and the `zelyo` bucket exists.
- [ ] `.env.example` contains every key in the index **Env keys** block; no secret carries `NEXT_PUBLIC_`; `cp .env.example .env` yields a parseable env.
- [ ] `pnpm --filter @zelyo/web typecheck` passes and `pnpm --filter @zelyo/web test` is green (env loader: 5 cases).
- [ ] `docs/toolchain.md` documents `noirup`→nargo 1.0.0-beta.22, `bbup`→bb (matching bb.js 4.3.x), Rust **1.90.0** + `wasm32-unknown-unknown` + soroban-sdk, Stellar CLI, and Friendbot funding.
- [ ] The spike ran end-to-end: circuit compiled, bb.js produced (and locally verified) a proof, and an on-chain verification attempt was made on testnet.
- [ ] `docs/superpowers/decisions/zk-verify-mode.md` exists with a concrete `ZK_VERIFY_MODE = onchain | server` outcome and cited evidence; `.env.example` reflects the chosen mode.
- [ ] `pnpm --filter @zelyo/zk-shared test` runs the Poseidon parity rig (1 pending vector, 0 failures) and `typecheck` passes; the contract type names (`FieldHex`, `Attributes`, `MERKLE_DEPTH`, `idCommitment`, `buildLeaf`, `computeNullifier`) match the index exactly.
- [ ] Repo layout matches SPEC §4 (`apps/web`, `packages/zk-shared`, `circuits/zelyo_credential`, `contracts/credential_registry`, `contracts/verifier`, `apps/web/public/circuit`).
