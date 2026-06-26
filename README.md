# Zelyo

> Verifiable credentials, sealed with zero-knowledge proofs — prove one fact without revealing who you are.

Zelyo is a privacy-preserving credential protocol that lets issuers mint tamper-proof credentials, holders store them locally, and verifiers confirm specific claims — all without ever seeing the underlying personal data. Built on **Stellar Soroban** smart contracts and **Noir** zero-knowledge circuits, Zelyo turns sensitive credentials into selective, wallet-bound, Sybil-resistant reveals.

| | |
| --- | --- |
| **Version** | `0.0.0` (pre-release) |
| **License** | [LICENSE_PLACEHOLDER] |
| **Monorepo** | pnpm workspaces (`apps/*`, `packages/*`) |
| **Primary Stack** | Next.js 16 · React 19 · TypeScript 6 · Stellar Soroban |
| **ZK Stack** | Noir 1.0.0-beta.22 · Barretenberg / bb.js · BN254 Poseidon2 |
| **CI/CD** | GitHub Actions → Railway |
| **Live Demo** | [DEMO_URL_PLACEHOLDER] |

---

## 🚨 Problem

Identity verification today is broken:

- **Over-disclosure** — every job application, KYC check, or badge verification forces people to hand over full documents, resumes, or IDs.
- **Centralized honeypots** — platforms store mountains of PII that become breach targets.
- **Slow, expensive trust** — verifying a credential often means calling a third party, waiting for an email, or trusting a screenshot.
- **No user control** — once you share a PDF diploma or passport scan, you lose control over who sees it, forever.

For freelancers, professionals, and anyone crossing borders, the cost of proving you are qualified is privacy itself.

---

## 🌟 Vision

A world where credentials are **portable, private, and provable**. Zelyo replaces "trust me, here is everything" with "here is a cryptographic proof of exactly one fact" — bound to your wallet, usable once, and never tied to your name on-chain.

We believe the future of work needs an identity layer that is:

- **Self-sovereign** — the holder controls the secret.
- **Privacy-preserving** — only the disclosed attribute leaves the device.
- **Composable** — any issuer, any verifier, any reward gate.

---

## 🎯 Purpose

Zelyo exists to make privacy-preserving verification practical for real products. It gives developers, issuers, and platforms a full-stack starter kit for:

1. Issuing a credential and anchoring its Merkle root on-chain.
2. Letting a holder generate a zero-knowledge proof in their browser.
3. Verifying the proof server-side (or on-chain when supported).
4. Letting the holder claim a gated reward with that proof — without doxxing themselves.

The chain records only a **nullifier** and a **bound wallet address**. Your name, your full credential, and your secret never reach it.

---

## 👥 Target Users

| User | Why Zelyo? |
| --- | --- |
| **Issuers** (universities, bootcamps, certifiers) | Mint fraud-resistant credentials and publish roots to a public registry without running a database of personal details. |
| **Holders** (freelancers, remote workers, professionals) | Carry proof of skills in your wallet; reveal only what the opportunity requires. |
| **Verifiers** (employers, marketplaces, DAOs) | Confirm claims cryptographically with no PII liability and no manual checks. |
| **Developers** | Extend the protocol with new gates, credentials, and reward types using the ZK + Soroban scaffold. |

---

## ✨ Features

### Credential Lifecycle

- 🏛️ **Issuer minting portal** — admins log in and issue credentials that become leaves in a Merkle tree.
- 🛡️ **Merkle-tree registry** — roots are anchored on Stellar Soroban; history and revocation are tracked on-chain.
- 💼 **Holder wallet** — credentials are stored as encrypted files in private S3-compatible storage, served via short-lived signed URLs.
- 🔐 **Local secret management** — holder secrets are generated in-browser with WebCrypto, persisted encrypted in IndexedDB, and never sent to the server.

### Zero-Knowledge Proving

- ⚡ **In-browser UltraHonk proofs** — powered by `@aztec/bb.js` and Noir; no trusted server sees the witness.
- 🔍 **Selective disclosure** — reveal a single attribute (e.g., `track`) without exposing name, email, or dates.
- 🔗 **Address binding** — proofs are bound to a Stellar wallet, preventing credential transfer.
- 🚫 **Sybil resistance** — deterministic nullifiers block double-spending of the same credential.

### Verification & Rewards

- ✅ **Server-side verification** — Path B (current default) verifies proofs off-chain and mirrors results to the Soroban registry.
- 🧩 **On-chain verification stub** — Path A contract is wired for future protocol support of BN254/Poseidon host functions.
- 🎁 **Gated job board** — verifiers post reward gates; holders claim token rewards or verified flags after a successful reveal.
- 🔗 **Explorer links** — every on-chain action surfaces a Stellar Expert link so users can audit what is (and is not) recorded.

### Hardening & Quality

- 🛡️ **Security headers** — centralized CSP, COOP/COEP for WASM threading, HSTS, XFO, and referrer/permissions policies.
- 📊 **Rate limiting** — per-IP floors on auth, verify, register, mint, and claim endpoints via Redis.
- 📝 **Audit logging** — PII-safe audit trail: only hashes, nullifiers, tx hashes, and result codes are stored.
- ♿ **Accessibility floor** — WCAG 2.1 AA checks with Playwright + axe; visible focus, ≥40 px hit targets, reduced-motion support.
- 🧪 **130+ tests** — Vitest unit tests, Playwright e2e acceptance specs, and contract `cargo test` coverage.

---

## 🛠️ Tech Stack

| Layer | Technology |
| --- | --- |
| **Frontend** | Next.js 16.2, React 19.2, TypeScript 6.0.3, TailwindCSS 4.3 |
| **Auth** | Auth.js v5 beta with credentials provider + Prisma adapter |
| **Database** | PostgreSQL 16, Prisma 7.8, `@prisma/adapter-pg` |
| **Cache / Rate limits** | Redis 7, `ioredis`, `rate-limiter-flexible` |
| **Object Storage** | MinIO (local), S3-compatible bucket (prod) |
| **Smart Contracts** | Rust 1.92, `soroban-sdk` 26, `wasm32v1-none` |
| **Zero Knowledge** | Noir 1.0.0-beta.22, `@noir-lang/noir_js`, `@aztec/bb.js` |
| **ZK Shared Lib** | `@zelyo/zk-shared` workspace package with Poseidon2 / BN254 field math |
| **Tooling** | pnpm 10.33, Node 22, ESLint 9, Vitest 4, Playwright |
| **Hosting** | Railway (Nixpacks builder) |

---

## 🚀 Local Development Setup

### Prerequisites

- Node.js 22+ and pnpm 10.33+
- Docker + Docker Compose
- Rust 1.92+ with `wasm32v1-none` target
- Stellar CLI
- Noir (`nargo` 1.0.0-beta.22) and Barretenberg `bb` CLI — see [`docs/toolchain.md`](./docs/toolchain.md)

### 1. Clone and install

```bash
git clone [REPO_URL_PLACEHOLDER]
cd zelyo
pnpm install
```

### 2. Start local infrastructure

```bash
docker compose up -d
```

This brings up PostgreSQL 16, Redis 7, and MinIO with a pre-created `zelyo` bucket.

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env with your secrets, especially AUTH_SECRET, ADMIN_PASSWORD, and ISSUER_SECRET
```

### 4. Migrate and seed the database

```bash
pnpm --filter @zelyo/web db:migrate
pnpm --filter @zelyo/web db:seed
```

The seed creates the admin user, issuer record, empty Merkle tree, and sample job gate.

### 5. Run the web app

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. (Optional) Build and deploy contracts to testnet

```bash
pnpm contracts:build
pnpm contracts:deploy
```

Copy the printed `CREDENTIAL_REGISTRY_CONTRACT_ID` and `VERIFIER_CONTRACT_ID` into `.env`. Contracts are deployed once per network, not on every app deploy.

### 7. (Optional) Build the ZK circuit

```bash
pnpm zk:build
```

Produces circuit artifacts, verification key, and `manifest.json` under `apps/web/public/circuit`.

---

## 🌐 Deployment

Zelyo ships to **Railway** via `railway.json` and `nixpacks.toml`.

### Railway services

- **Web** — this repo.
- **PostgreSQL** plugin → injects `DATABASE_URL` and `DIRECT_URL`.
- **Redis** plugin → injects `REDIS_URL`.
- **Object Storage** plugin (or any S3-compatible bucket) → set `S3_*` variables.

### Required Railway variables

All secrets live in Railway only. The only public client variable is `NEXT_PUBLIC_EXPLORER_BASE`.

```
APP_URL, AUTH_SECRET, AUTH_URL, AUTH_TRUST_HOST=true,
DATABASE_URL, DIRECT_URL, REDIS_URL,
S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_FORCE_PATH_STYLE,
STELLAR_NETWORK=testnet, NETWORK_PASSPHRASE, SOROBAN_RPC_URL, HORIZON_URL,
ISSUER_SECRET, ISSUER_STELLAR_ACCOUNT,
CREDENTIAL_REGISTRY_CONTRACT_ID, VERIFIER_CONTRACT_ID,
ZK_SCOPE_APP_ID, ZK_VERIFY_MODE=server,
CIRCUIT_ARTIFACT_BASE=/circuit,
ADMIN_USERNAME, ADMIN_PASSWORD, ISSUER_NAME,
NEXT_PUBLIC_EXPLORER_BASE
```

### Release flow

1. Railway runs the Nixpacks build from `railway.json`.
2. `preDeployCommand` runs `prisma migrate deploy` and `prisma db seed`.
3. `startCommand` runs `pnpm start`.
4. Healthcheck hits `/api/health`.

Contracts are deployed separately from a developer machine or dedicated CI job — never during the web release. See [`docs/DEPLOY.md`](./docs/DEPLOY.md) for the full runbook.

---

## 🎥 Demo

- **Live app:** [DEMO_URL_PLACEHOLDER]
- **Video walkthrough:** [VIDEO_URL_PLACEHOLDER]
- **Pitch deck:** [DECK_URL_PLACEHOLDER]

> Quick flow to try locally:
> 1. Log in as the seeded admin at `/login`.
> 2. Mint a credential for a holder at `/issuer/mint`.
> 3. Log in as the holder, back up the holder secret at `/wallet/keys`.
> 4. Generate a ZK proof at `/wallet/prove/[credentialId]`.
> 5. See the reveal result at `/verify/result/[txHash]`.
> 6. Claim a gated reward at `/jobs/[slug]`.

---

## 👋 Team

| Name | Role | GitHub / Contact |
| --- | --- | --- |
| [TEAM_MEMBER_1] | [ROLE_PLACEHOLDER] | [LINK_PLACEHOLDER] |
| [TEAM_MEMBER_2] | [ROLE_PLACEHOLDER] | [LINK_PLACEHOLDER] |
| [TEAM_MEMBER_3] | [ROLE_PLACEHOLDER] | [LINK_PLACEHOLDER] |

We are builders, researchers, and designers who believe privacy infrastructure should be beautiful, usable, and open.

---

## 📄 License

[LICENSE_PLACEHOLDER] — see [`LICENSE`](./LICENSE) for details.

---

## 🧑‍💻 Developer Reference

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Holder Browser                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Holder Secret│  │ ZK Prover    │  │ Wallet / Claim Panel     │  │
│  │ (WebCrypto)  │  │ (Noir + bb.js│  │ (React + Next.js)        │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
└────────────────────┬────────────────────────────────────────────────┘
                     │ proof, publicInputs
┌────────────────────▼────────────────────────────────────────────────┐
│                         Next.js App (@zelyo/web)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Auth.js      │  │ Credential   │  │ Verification Service     │  │
│  │ Prisma/DB    │  │ Service      │  │ (server-side Path B)     │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Job Gate     │  │ Stellar      │  │ Audit / Rate Limit       │  │
│  │ Service      │  │ Helpers      │  │ Security Headers         │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
└────────────────────┬────────────────────────────────────────────────┘
                     │ set_root / register / tx mirror
┌────────────────────▼────────────────────────────────────────────────┐
│                    Stellar Soroban (testnet)                        │
│  ┌────────────────────────┐      ┌────────────────────────────┐    │
│  │ credential_registry    │      │ verifier                   │    │
│  │ - root set / revoke    │      │ - UltraHonk verify stub    │    │
│  │ - register (Path B)    │      │   (Path A future)          │    │
│  │ - verify_and_register  │      │                            │    │
│  └────────────────────────┘      └────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### Project Structure

```
zelyo/
├── apps/
│   └── web/                    # Next.js application
│       ├── prisma/             # Schema, migrations, seed
│       ├── public/circuit/     # ZK circuit artifacts
│       ├── src/
│       │   ├── app/            # App router pages
│       │   ├── components/     # Reusable UI
│       │   ├── lib/            # Shared clients / utilities
│       │   ├── server/         # Domain services
│       │   └── middleware.ts   # Security headers / auth
│       └── tests/              # Vitest + Playwright specs
├── packages/
│   └── zk-shared/              # Poseidon2 + field math + contract types
├── contracts/
│   ├── credential_registry/    # Soroban credential registry contract
│   └── verifier/               # Soroban ZK verifier contract
├── circuits/                   # Noir circuit source
├── scripts/                    # Contract deploy, ZK build helpers
├── docs/                       # Runbooks and feature log
├── .github/workflows/          # CI + E2E acceptance
├── docker-compose.yml          # Local infra
├── railway.json                # Railway build/deploy config
└── nixpacks.toml               # Node 22 + pnpm 10 toolchain
```

### Scripts

| Script | Description |
| --- | --- |
| `pnpm dev` | Start the Next.js dev server |
| `pnpm build` | Build the web app for production |
| `pnpm start` | Start the production Next.js server |
| `pnpm lint` | Lint all workspace packages |
| `pnpm typecheck` | Run TypeScript checks across the monorepo |
| `pnpm test` | Run unit tests across all packages |
| `pnpm test:e2e` | Run Playwright acceptance tests |
| `pnpm db:migrate` | Run Prisma migrations in dev |
| `pnpm db:seed` | Seed the database |
| `pnpm zk:build` | Compile Noir circuit and write verification key |
| `pnpm contracts:build` | Build Soroban contracts to WASM |
| `pnpm contracts:deploy` | Deploy contracts to Stellar testnet |

### Environment Variables

| Variable | Purpose | Scope |
| --- | --- | --- |
| `APP_URL` | Canonical app URL | Server |
| `AUTH_SECRET` | Auth.js signing secret (≥32 bytes) | Server secret |
| `DATABASE_URL` / `DIRECT_URL` | PostgreSQL connections | Server secret |
| `REDIS_URL` | Redis connection | Server secret |
| `S3_*` | S3-compatible object storage config | Server secret |
| `STELLAR_NETWORK` | `testnet` | Server |
| `SOROBAN_RPC_URL` / `HORIZON_URL` | Stellar endpoints | Server |
| `ISSUER_SECRET` | Server-side signer for roots and rewards | Server secret |
| `CREDENTIAL_REGISTRY_CONTRACT_ID` | Deployed registry contract | Server |
| `VERIFIER_CONTRACT_ID` | Deployed verifier contract | Server |
| `ZK_SCOPE_APP_ID` | App domain separator for nullifiers | Server |
| `ZK_VERIFY_MODE` | `server` (Path B) or `onchain` (Path A) | Server |
| `CIRCUIT_ARTIFACT_BASE` | Public path for circuit files | Server |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Seeded admin credentials | Server secret |
| `ISSUER_NAME` / `ISSUER_STELLAR_ACCOUNT` | Issuer metadata | Server |
| `NEXT_PUBLIC_EXPLORER_BASE` | Stellar Expert base URL | Public |

> **Security rule:** only `NEXT_PUBLIC_EXPLORER_BASE` is exposed to the browser. No secret variable uses the `NEXT_PUBLIC_` prefix.

### CI/CD

- **CI (`ci.yml`)** — runs on every PR to `develop`. Installs deps, lints, typechecks, runs unit tests, builds the app, and fails on critical `pnpm audit` findings.
- **E2E / Acceptance (`e2e.yml`)** — runs on push to `develop` or manually. Brings up postgres/redis/minio, migrates/seeds, builds, and runs Playwright specs including auth, reveals, and accessibility. Kept out of the PR-blocking path because reveal specs depend on live testnet secrets.
- **Railway deploy** — `railway.json` defines the build, pre-deploy migration/seed, start command, and healthcheck. `nixpacks.toml` pins Node 22 and pnpm 10.

### Branching Strategy

- `main` — production-ready releases.
- `develop` — integration branch; all PRs merge here first.
- Feature branches — branch from `develop`, follow the pattern `feat/...`, `fix/...`, `docs/...`.
- No auto-merge: humans review and merge every PR.

---

## 📚 Further Reading

- [`docs/features.md`](./docs/features.md) — append-only log of shipped phases and deviations.
- [`docs/DEPLOY.md`](./docs/DEPLOY.md) — complete Railway deployment and contract runbook.
- [`docs/toolchain.md`](./docs/toolchain.md) — Noir, Barretenberg, Rust, and Stellar CLI setup.
- [`contracts/`](./contracts) — Soroban smart contract source and tests.
- [`circuits/`](./circuits) — Noir zero-knowledge circuit and tests.
- [`packages/zk-shared/`](./packages/zk-shared) — shared field math, Poseidon2 helpers, and contract types.

---

Built with care by the Zelyo team. Privacy is the default.
