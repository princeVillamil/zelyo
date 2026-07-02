# Zelyo — Application Specification (SPEC.md)

> ZK-backed verifiable credentials on Stellar. An issuer mints a credential to a learner's Stellar wallet; the learner proves **one fact** about it in zero-knowledge without exposing personal data; the proof is verified on-chain via a Soroban contract, where the only thing recorded is a **nullifier**.

This document is the build contract for a code-generation agent. It is exhaustive by design: pages, routes, endpoints, data model, ZK layer, on-chain contracts, third-party services, environment, security, and acceptance criteria. Pair it with `AGENT.md` (engineering rules) and `BRAND.md` (design system).

---

## 1. Scope (one-month build)

| Priority | In scope |
|---|---|
| **Must** | Issuer mint flow (attributes → commitment leaf → Merkle insert → publish root on-chain → return VC); Noir circuit (Merkle inclusion + nullifier + address binding + one disclosed predicate); `CredentialRegistry` Soroban contract (stores root, calls reused verifier, enforces nullifier uniqueness); Holder UI (receive credential, prove in-browser, submit). |
| **Should** | Explorer "nothing on-chain" reveal panel; live Sybil block (verify-twice → rejected); selective-disclosure toggle; Stellar money-rails unlock (proof claims a testnet asset / opens a token gate). |
| **Could** | Revocation (issuer updates root, old proof fails); verifier-chosen trusted issuers; range/date predicate. |
| **Won't** | In-circuit issuer signatures, BBS+/JWP, full W3C VC / OID4VC wallet interop, multi-tenant issuer onboarding/billing, HSM/KMS key management. |

**Three demo reveals** (these are acceptance scenarios, see §13): (1) nothing personal on-chain, (2) Sybil block live, (3) selective disclosure unlocking a Stellar-native claim.

---

## 2. Tech stack (pinned to latest as of build)

> The agent must resolve to the **current latest** of each at install time; versions below were verified current and are the floor. Do not downgrade.

| Layer | Choice | Version |
|---|---|---|
| Runtime | Node.js | 22 LTS (≥ 22.x) |
| Package manager | pnpm | 10.x |
| Framework | Next.js (App Router, frontend + API route handlers) | 16.2.x |
| UI runtime | React / React DOM | 19.2.x |
| Language | TypeScript (strict) | 6.0.x |
| Styling | Tailwind CSS v4 (CSS-first `@theme`) + `@tailwindcss/postcss` + `@tailwindcss/forms` | 4.3.x / 0.5.x |
| ORM | Prisma + `@prisma/client` | 7.8.x |
| DB | PostgreSQL (Railway) | 16 |
| Auth | Auth.js v5 (`next-auth@5` beta) Credentials provider + `@auth/prisma-adapter` | 5.0.0-beta.x |
| Validation | Zod | 4.x |
| Forms | react-hook-form + `@hookform/resolvers` | 7.x / 5.x |
| Password hashing | `@node-rs/argon2` (argon2id) | 2.x |
| Cache / rate limit / jobs | Redis via `ioredis` + `rate-limiter-flexible` | 5.x / 11.x |
| Object storage | S3-compatible: `@aws-sdk/client-s3` (prod = Railway bucket; dev = MinIO via `minio`/S3 API) | 3.x / 8.x |
| Logging | `pino` + `pino-http` | 10.x / 11.x |
| ZK circuit | Noir (`nargo` via `noirup`) | 1.0.0-beta.22 |
| ZK proving (browser) | `@noir-lang/noir_js`, `@noir-lang/noir_wasm`, `@aztec/bb.js` (Barretenberg, UltraHonk) | beta.22 / 4.3.x |
| Stellar client | `@stellar/stellar-sdk` (Horizon + Soroban RPC + contract client) | 16.x |
| Soroban contracts | Rust `soroban-sdk` (pin current release; requires protocol with BN254 + Poseidon host fns) + Stellar CLI | latest |
| Merkle (JS) | `@zk-kit/imt` + a Poseidon impl that is **bit-identical** to the circuit's (see §6.4) | latest |
| Test | Vitest (unit) + Playwright (e2e) | 4.x / 1.x |
| Lint/format | ESLint + Prettier | 10.x / 3.x |

Deployment target: **Railway** (web service, Postgres, Redis, object storage). Stellar **testnet** for the demo.

---

## 3. System architecture

Three trust roles connected through a Soroban registry. **Proving happens on the holder's device.** The chain only ever sees a proof, a root, and a nullifier — never personal data.

```
ISSUER (admin)                      HOLDER (browser + wallet)            VERIFIER (job board)
  Next.js issuer portal               Next.js wallet UI                    Next.js public gate
  └ build leaf, insert into           ├ holds secret s (local only)        └ submits proof to chain
    server Merkle tree                ├ Noir + bb.js prover (WASM)            via /api/verify
  └ publish root  ─────────┐          └ generate proof, submit  ──┐
                           ▼                                       ▼
                 STELLAR · SOROBAN
                   CredentialRegistry contract
                     ├ set_root (issuer-only)         reads → published Merkle root
                     ├ verify_and_register  ────────→ ZK verifier (reused, UltraHonk/Groth16)
                     ├ nullifier set (Sybil block)    BN254 + Poseidon host fns (Protocol "X-Ray")
                     └ emits Verified event → JobGate unlock / claimable balance
```

Off-chain Postgres stores issuer records, attributes (issuer's own copy, access-controlled), Merkle leaves/tree state, and a **mirror** of nullifiers/roots for fast UI. **The chain is the source of truth for nullifier uniqueness and root validity.**

---

## 4. Repository layout (pnpm workspace)

```
zelyo/
├─ apps/
│  └─ web/                      # Next.js 16 app (frontend + API route handlers)
│     ├─ src/app/               # App Router (pages + /api route handlers)
│     ├─ src/lib/               # server libs: db, auth, stellar, zk, storage, redis, logger
│     ├─ src/components/        # UI components (BRAND.md)
│     ├─ src/server/            # services: merkle, credential, verification, jobgate
│     ├─ prisma/                # schema.prisma, migrations, seed.ts
│     └─ public/circuit/        # served circuit artifact + verification key (cacheable)
├─ circuits/
│  └─ zelyo_credential/         # Noir package (Nargo.toml, src/main.nr)
├─ contracts/
│  ├─ credential_registry/      # Rust Soroban contract
│  └─ verifier/                 # reused/imported verifier wiring
├─ packages/
│  └─ zk-shared/                # TS: poseidon (circuit-parity), leaf/nullifier builders, types
├─ docker-compose.yml           # dev: postgres, redis, minio
├─ .env.example
├─ AGENT.md  BRAND.md  SPEC.md
└─ package.json  pnpm-workspace.yaml
```

---

## 5. Pages (App Router)

All authenticated areas are role-gated by middleware (§10). Visual language per `BRAND.md` (editorial/archival "Cryptographic Press" theme).

### Public
- `/` — Landing. The three-reveal narrative, CTA to issuer/holder/verifier. 
- `/login` — Credentials sign-in (username + password).
- `/register` — Holder self-registration (username + password). Generates the holder secret `s` **client-side** on first wallet visit, not here.
- `/jobs` — Public job board: list of `JobGate`s, each with a required predicate (e.g. "Data Engineering grad").
- `/jobs/[slug]` — A gated action. "Prove with Zelyo" → opens holder prove flow (or deep-links if logged in) → on success unlocks the claim.
- `/verify/result/[txHash]` — Verification result. **Explorer reveal panel** (links to Stellar testnet explorer, shows the tx contains only a nullifier hash + proof, no PII), success/Sybil-rejection states.

### Issuer portal (role `ADMIN`)
- `/issuer` — Dashboard: counts (credentials issued, current root, last publish tx).
- `/issuer/mint` — **Mint New Credential** (the editorial ledger form): learner full name, course of study, grade, issue date, target holder (username or pasted `id_commitment`). Right column: Commitment Preview (DATA→HASH→PROOF/ROOT schematic) + live mint log. On submit → §7 mint flow.
- `/issuer/credentials` — Folio Library: list/search issued credentials, status, root at issuance, revoke action (Could).

### Holder wallet (role `HOLDER`)
- `/wallet` — My Credentials: credential cards (status, course, issuer, date, signature hash) + recent history.
- `/wallet/credentials/[id]` — Credential detail + raw VC download.
- `/wallet/prove/[id]` — **Selective disclosure** panel (toggle attributes to disclose; default reveal only the predicate, hide name/grade) + bind to Stellar address + **Generate ZK-Proof** (foil-stamp button). Proves in-browser, then submits to `/api/verify` (or directly to chain) and routes to `/verify/result/[txHash]`.
- `/wallet/keys` — Shows the holder's public `id_commitment`; lets them back up / restore the secret `s` (client-side only, e.g. encrypted blob the user copies). The secret is **never** sent to the server.

### Admin (role `ADMIN`)
- `/admin/users` — minimal user list (seeded admin). No PII beyond username.

---

## 6. ZK layer

### 6.1 Circuit (`circuits/zelyo_credential/src/main.nr`)
Proves, with **private** inputs (`s`, `attributes`, `merkle_path`) and **public** inputs/outputs (`root`, `scope`, `bound_address`, `nullifier`, `disclosed`):

```
// PRIVATE
priv s            // holder identity secret (never leaves device)
priv attributes   // { track, grade, issue_date, ... } as field elements
priv merkle_path  // siblings + indices to the published root

// PUBLIC
pub root          // issuer's published Merkle root
pub scope         // Hash(app_id | chain_id | registry_address)
pub bound_address // holder Stellar address (ed25519 pubkey, as field-packed bytes)
pub nullifier     // output
pub disclosed     // the single revealed attribute (e.g. track)

// CONSTRAINTS
leaf = Poseidon( Poseidon(s), Poseidon(attributes) )
assert merkle_verify(leaf, merkle_path) == root      // validity
assert attributes.track == disclosed                  // selective disclosure
assert nullifier == Poseidon(s, scope)                // Sybil resistance
// bind_address: mix bound_address into the proof's public inputs so the proof
// is non-malleable to a different wallet (a dummy constraint referencing it).
```

Fixed Merkle depth (recommend **20**, ≈1M leaves). One disclosed predicate for the demo (`track`). Compile with `nargo compile`; export ACIR + ABI to `apps/web/public/circuit/`.

### 6.2 Proving (browser)
Use `@noir-lang/noir_js` + `@aztec/bb.js` (UltraHonk). Flow: load ACIR → `noir.execute(inputs)` → `bb` generate proof → submit `{proof, publicInputs}`. **Barretenberg uses WASM threads → requires COOP/COEP headers** (see AGENT.md §Gotchas). Verification key is generated at build time and embedded in the verifier contract / used by the registry.

### 6.3 Nullifier & binding
`nullifier = Poseidon(s, scope)`, `scope = Hash(app_id | chain_id | registry_contract_id)` so the same learner is unlinkable across apps/deployments but limited to one registration per app. `bound_address` is a public input the contract asserts equals the invoker, preventing mempool replay to another wallet.

### 6.4 Poseidon parity (critical)
The JS code that builds leaves (`packages/zk-shared`) **must produce identical field outputs** to the circuit's Poseidon over BN254. Mismatched params silently break inclusion proofs. Strategy: derive leaves from the **same** implementation the circuit uses (prefer computing the leaf via a tiny Noir helper / shared WASM, or a vetted lib pinned to the circuit's Poseidon params). Add a parity unit test asserting JS leaf == circuit leaf for fixed vectors.

---

## 7. Core flows

### 7.1 Mint (issuer, `ADMIN`)
1. `POST /api/issuer/credentials` with `{ holder: {username|idCommitment}, attributes }`.
2. Resolve `id_commitment` for the holder (from `HolderKey`, or accept pasted value).
3. Server builds `leaf = Poseidon(id_commitment, Poseidon(attributes))`.
4. Insert `leaf` into the server Merkle tree (`@zk-kit/imt`), persist `Leaf` + recompute `rootHex`.
5. **Publish root on-chain**: `CredentialRegistry.set_root(issuer, rootHex)` signed by `ISSUER_SECRET` (server-only). Record `RootHistory{rootHex, txHash}`.
6. Persist `Credential` (attributes, `leafHex`, `leafIndex`, `merkleRootHex`, `vcFileKey`). Write VC JSON to object storage.
7. Return credential summary + VC reference. Mint log streams steps to the UI (SSE or polling).

### 7.2 Prove + verify (holder → chain)
1. Holder opens `/wallet/prove/[id]`, selects disclosure, binds Stellar address.
2. Browser fetches circuit artifact + the credential's `merkle_path`, `root`; generates proof.
3. `POST /api/verify` `{ proof, publicInputs:{root, scope, boundAddress, nullifier, disclosed} }`.
4. Server pre-checks `root` ∈ valid `RootHistory` and `nullifier` not already mirrored (fast fail), then submits `CredentialRegistry.verify_and_register(proof, publicInputs)`.
5. Contract: verify proof (reused verifier) → assert root valid → assert `boundAddress` matches → check nullifier unused → store nullifier → emit `Verified` event. On duplicate nullifier → revert with `NullifierUsed` (the **Sybil block**).
6. Mirror nullifier + `Verification` row; return `{ ok, txHash, explorerUrl }`. UI routes to `/verify/result/[txHash]`.

### 7.3 Unlock (Stellar money-rails, Should)
On `Verified` for a `JobGate`'s predicate, the contract (or a follow-up server tx) issues a claimable balance of a testnet asset to `boundAddress`, or flips `is_verified(address)=true` that the JobGate reads. Record `GateClaim`.

---

## 8. API endpoints (Next.js route handlers)

All mutating endpoints: Zod-validated body, RBAC, rate-limited, audit-logged. Errors return `{ error: { code, message } }` with appropriate status; never leak stack traces.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `*` | `/api/auth/*` | — | Auth.js (sign-in/out, session, CSRF). |
| `POST` | `/api/holder/register` | public | Create `HOLDER` user (username, password). |
| `PUT` | `/api/holder/commitment` | HOLDER | Upsert caller's `id_commitment` (public value). |
| `GET` | `/api/holder/credentials` | HOLDER | List caller's credentials w/ `merkle_path`, `root`, `leafIndex`. |
| `GET` | `/api/holder/credentials/[id]/vc` | HOLDER (owner) | Signed URL / stream of VC JSON. |
| `POST` | `/api/issuer/credentials` | ADMIN | Mint (see §7.1). |
| `GET` | `/api/issuer/credentials` | ADMIN | List issued (filter/paginate). |
| `POST` | `/api/issuer/credentials/[id]/revoke` | ADMIN | Remove leaf, republish root (Could). |
| `GET` | `/api/registry/root` | public | Current root + on-chain ref. |
| `GET` | `/api/registry/nullifier/[hash]` | public | Mirror lookup (chain authoritative). |
| `GET` | `/api/circuit/manifest` | public | Circuit artifact URLs + hash + ABI + scope params. |
| `POST` | `/api/verify` | public | Submit proof → on-chain `verify_and_register` (see §7.2). |
| `GET` | `/api/verify/[txHash]` | public | Verification record/status. |
| `GET` | `/api/jobboard/gates` | public | List job gates. |
| `GET` | `/api/jobboard/gates/[slug]` | public | Gate detail + required predicate. |
| `POST` | `/api/jobboard/gates/[slug]/claim` | public | Claim after a valid verification (refs nullifier/txHash). |
| `GET` | `/api/health` | public | Liveness/readiness (db, redis, rpc). |

Rate-limit floors (per IP, `rate-limiter-flexible` + Redis): auth 10/min, `/api/verify` 20/min, register 5/min, mint 60/min (admin). Tighten as needed.

---

## 9. Data model (Prisma — `apps/web/prisma/schema.prisma`)

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL"); directUrl = env("DIRECT_URL") }

enum Role { ADMIN HOLDER }
enum CredentialStatus { ACTIVE REVOKED }
enum VerificationResult { VERIFIED INVALID_PROOF UNKNOWN_ROOT NULLIFIER_USED ERROR }

model User {
  id           String   @id @default(cuid())
  username     String   @unique
  passwordHash String
  role         Role     @default(HOLDER)
  holderKey    HolderKey?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Issuer {
  id              String   @id @default(cuid())
  name            String                       // e.g. "Institute of Distributed Systems"
  stellarAccount  String                       // public G-address used to publish roots
  createdAt       DateTime @default(now())
  credentials     Credential[]
}

model HolderKey {
  id           String   @id @default(cuid())
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId       String   @unique
  idCommitment String   @unique                 // Poseidon(s) — PUBLIC. secret s NEVER stored
  createdAt    DateTime @default(now())
  credentials  Credential[]
}

model MerkleTree {
  id        String   @id @default(cuid())
  depth     Int      @default(20)
  rootHex   String
  leafCount Int      @default(0)
  updatedAt DateTime @updatedAt
  leaves    Leaf[]
}

model Leaf {
  id           String   @id @default(cuid())
  tree         MerkleTree @relation(fields: [treeId], references: [id])
  treeId       String
  index        Int
  leafHex      String
  credential   Credential?
  createdAt    DateTime @default(now())
  @@unique([treeId, index])
}

model RootHistory {
  id          String   @id @default(cuid())
  rootHex     String   @unique
  txHash      String?
  valid       Boolean  @default(true)
  publishedAt DateTime @default(now())
}

model Credential {
  id            String   @id @default(cuid())
  issuer        Issuer   @relation(fields: [issuerId], references: [id])
  issuerId      String
  holderKey     HolderKey @relation(fields: [holderKeyId], references: [id])
  holderKeyId   String
  attributes    Json                            // {track, grade, issueDate, courseName, learnerName}
  leaf          Leaf     @relation(fields: [leafId], references: [id])
  leafId        String   @unique
  leafIndex     Int
  merkleRootHex String                          // root at issuance
  vcFileKey     String                          // object-storage key
  status        CredentialStatus @default(ACTIVE)
  createdAt     DateTime @default(now())
}

model Nullifier {
  id           String   @id @default(cuid())
  nullifierHex String   @unique
  scope        String
  boundAddress String
  txHash       String?
  createdAt    DateTime @default(now())
}

model Verification {
  id           String   @id @default(cuid())
  nullifierHex String
  disclosed    Json
  boundAddress String
  result       VerificationResult
  txHash       String?
  explorerUrl  String?
  jobGate      JobGate? @relation(fields: [jobGateId], references: [id])
  jobGateId    String?
  createdAt    DateTime @default(now())
}

model JobGate {
  id                String   @id @default(cuid())
  slug              String   @unique
  title             String
  description       String
  requiredPredicate Json                        // {attribute:"track", equals:"Data Engineering"}
  rewardType        String                      // "CLAIMABLE_BALANCE" | "FLAG"
  rewardConfig      Json
  verifications     Verification[]
  claims            GateClaim[]
  createdAt         DateTime @default(now())
}

model GateClaim {
  id           String   @id @default(cuid())
  jobGate      JobGate  @relation(fields: [jobGateId], references: [id])
  jobGateId    String
  nullifierHex String
  boundAddress String
  txHash       String?
  createdAt    DateTime @default(now())
  @@unique([jobGateId, nullifierHex])
}

model AuditLog {
  id          String   @id @default(cuid())
  actorUserId String?
  action      String
  target      String?
  ip          String?
  meta        Json?
  createdAt   DateTime @default(now())
}
```

> If using the Auth.js Prisma adapter with database sessions, add `Account`/`Session`/`VerificationToken` models per the adapter docs. With the **Credentials** provider the session strategy is **JWT** (adapter optional); store `role` and `userId` in the token.

---

## 10. Authentication & authorization

- **Auth.js v5**, Credentials provider, **JWT session strategy** (Credentials requires JWT). Cookies: `httpOnly`, `secure` (prod), `sameSite=lax`. `AUTH_SECRET` from env (≥ 32 bytes random).
- Passwords hashed with **argon2id** (`@node-rs/argon2`). Never store or log plaintext.
- `authorize()` looks up `User`, verifies password, returns `{ id, username, role }`. `jwt`/`session` callbacks attach `role` + `userId`.
- **Middleware** (`apps/web/src/middleware.ts`): protect `/issuer/**` (ADMIN), `/wallet/**` (HOLDER), `/admin/**` (ADMIN); redirect unauth to `/login`. Re-check role server-side in each route handler (never trust client).
- **Holder secret `s`** is generated and stored **client-side only** (e.g. WebCrypto-encrypted blob in IndexedDB + user-exportable backup). The server only ever sees `id_commitment = Poseidon(s)`.

### Seed (`apps/web/prisma/seed.ts`)
Idempotent. Creates: the admin user (`ADMIN_USERNAME`/`ADMIN_PASSWORD`, role `ADMIN`, argon2id hash), one `Issuer` (`ISSUER_NAME`, `ISSUER_STELLAR_ACCOUNT`), an empty `MerkleTree` (depth 20, root = empty-tree root), and a demo `JobGate` (`data-engineering`, predicate `track == "Data Engineering"`, reward `CLAIMABLE_BALANCE`). Run via `pnpm prisma db seed`.

---

## 11. Third-party services

| Service | Use | Notes |
|---|---|---|
| **Railway Postgres** | primary DB | `DATABASE_URL` (+ `DIRECT_URL` for migrations). |
| **Railway Redis** | rate limiting, mint-log pub/sub, light queue | `REDIS_URL`. |
| **Railway object storage** (S3-compatible) | VC JSON, circuit artifacts backup | accessed via `@aws-sdk/client-s3`; dev = MinIO. Private bucket + signed URLs. |
| **Stellar testnet Soroban RPC** | contract invocation | `SOROBAN_RPC_URL`, `NETWORK_PASSPHRASE` (Test SDF Network ; September 2015). |
| **Stellar Horizon (testnet)** | account/tx queries, funding | `HORIZON_URL`. |
| **Friendbot** | fund testnet accounts | dev/demo only. |
| **Stellar testnet explorer** | the "nothing on-chain" reveal | link out by tx hash. |

---

## 12. Environment variables (`.env.example`)

```bash
# Core
NODE_ENV=development
APP_URL=http://localhost:3000
LOG_LEVEL=info

# Auth.js
AUTH_SECRET=                      # openssl rand -base64 48
AUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true

# Database (Railway Postgres)
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
CIRCUIT_ARTIFACT_BASE=/circuit    # served from public/circuit

# Seed (admin)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=                    # strong; set per environment
ISSUER_NAME=Institute of Distributed Systems
ISSUER_STELLAR_ACCOUNT=
```

`NEXT_PUBLIC_*` only for non-secret client config (e.g. `NEXT_PUBLIC_EXPLORER_BASE`). **No secret may carry the `NEXT_PUBLIC_` prefix.**

---

## 13. Acceptance criteria (mapped to the demo)

1. **Nothing personal on-chain.** A successful verification produces a testnet tx whose payload contains only the nullifier hash + proof; `/verify/result/[txHash]` links to the explorer and asserts (by inspection) no name/email/attributes appear on-chain. The DB never writes attributes to any on-chain call.
2. **Sybil block.** Submitting a second proof with the same `nullifier` returns `NULLIFIER_USED`; the UI shows the rejection. First submission succeeds and is recorded.
3. **Selective disclosure unlocks a claim.** The holder discloses only `track` (name/grade hidden); a valid proof against the `data-engineering` gate triggers a claimable balance / flag for `boundAddress`, recorded as a `GateClaim`.
4. **Auth & roles.** Seeded admin can mint; holders cannot reach `/issuer/**`; unauth users are redirected.
5. **Reproducible env.** `docker-compose up` + `pnpm i` + `pnpm prisma migrate dev` + `pnpm prisma db seed` + `pnpm dev` yields a working local stack.

---

## 14. Dev configuration

### `docker-compose.yml` (services)
- **postgres** (16): user/db `zelyo`, port 5432, healthcheck.
- **redis** (7): port 6379.
- **minio**: ports 9000 (API) / 9001 (console), `minioadmin` creds, plus a `createbuckets` init container that makes the `zelyo` bucket.

### Local toolchain (outside compose)
- `noirup` → install `nargo` 1.0.0-beta.22; `nargo compile` the circuit; copy artifact to `apps/web/public/circuit/`.
- Stellar CLI (install script) → `stellar contract build` (optimizes by default), deploy `credential_registry` + verifier to testnet, write IDs into `.env`. Fund the issuer account via Friendbot.

### Scripts (`package.json`)
`dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:e2e`, `db:migrate` (`prisma migrate dev`), `db:seed`, `zk:build`, `contracts:build`, `contracts:deploy`.

---

## 15. Deployment (Railway)

- **web** service: build `pnpm i --frozen-lockfile && pnpm prisma generate && pnpm build`; release step runs `pnpm prisma migrate deploy && pnpm prisma db seed`; start `pnpm start`. Set COOP/COEP headers (AGENT.md) so bb.js threads work.
- **postgres**, **redis**, **bucket**: Railway plugins; inject `DATABASE_URL`/`DIRECT_URL`, `REDIS_URL`, S3 creds.
- Contracts are deployed once to testnet from a developer machine / CI job; contract IDs set as Railway env vars.
- All secrets via Railway variables; nothing committed. Enable HTTPS (Railway default) and verify security headers in prod.
