# Zelyo — Railway Deployment (SPEC §15)

The web app is a pnpm-monorepo Next.js service. Railway builds, migrates/seeds,
and starts it from the repo root using `railway.json` + `nixpacks.toml`.

## Services (Railway project)

- **web** — this repo. Build / release / start commands in `railway.json`.
- **Postgres** plugin → injects `DATABASE_URL` (also set `DIRECT_URL` to the same
  value so `prisma migrate deploy` uses a direct connection).
- **Redis** plugin → injects `REDIS_URL` (rate-limiter-flexible store).
- **Bucket** (Railway object storage / any S3-compatible) → set `S3_ENDPOINT`,
  `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`,
  `S3_FORCE_PATH_STYLE`. Bucket stays **private**; VC files are served via
  short-lived signed URLs only.

## Required variables (Railway → web → Variables) — secrets ONLY here, never committed

```
APP_URL, AUTH_SECRET (≥32 bytes), AUTH_URL, AUTH_TRUST_HOST=true, LOG_LEVEL=info,
DATABASE_URL, DIRECT_URL, REDIS_URL,
S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_FORCE_PATH_STYLE,
STELLAR_NETWORK=testnet, NETWORK_PASSPHRASE, SOROBAN_RPC_URL, HORIZON_URL,
ISSUER_SECRET (server-only testnet key — never NEXT_PUBLIC),
ISSUER_STELLAR_ACCOUNT,
CREDENTIAL_REGISTRY_CONTRACT_ID, VERIFIER_CONTRACT_ID,
ZK_SCOPE_APP_ID, ZK_VERIFY_MODE (onchain|server — Phase 0 decision: server),
CIRCUIT_ARTIFACT_BASE=/circuit, ADMIN_USERNAME, ADMIN_PASSWORD,
ISSUER_NAME, NEXT_PUBLIC_EXPLORER_BASE.
```

The only `NEXT_PUBLIC_` key is `NEXT_PUBLIC_EXPLORER_BASE`. No secret carries a
`NEXT_PUBLIC_` prefix.

## Headers in prod

`next.config.ts` (via `src/lib/security-headers.ts`) emits HSTS +
`Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy:
require-corp` in production so bb.js WASM threads get cross-origin isolation.
Railway terminates TLS (HTTPS by default). After the first deploy, verify:

```bash
curl -sI https://<app>.up.railway.app | grep -iE 'strict-transport|cross-origin|content-security|x-frame'
```

## Contracts are deployed ONCE (not per web deploy)

Soroban contracts are deployed a single time to testnet from a developer machine
or a dedicated CI job — **never** during the web build/release. Steps:

1. `pnpm contracts:build`   # stellar contract build (optimizes by default)
2. `pnpm contracts:deploy`  # deploys credential_registry + verifier to testnet,
                            # funds the issuer account via Friendbot (dev), prints IDs
3. Copy the printed `CREDENTIAL_REGISTRY_CONTRACT_ID` and `VERIFIER_CONTRACT_ID`
   into Railway → web → Variables. The web service NEVER deploys contracts.
4. Re-run only when a contract changes; bump the IDs in Railway afterward.

A dedicated GitHub Actions `deploy-contracts` workflow (manual `workflow_dispatch`)
may run the same three steps using a secret testnet `ISSUER_SECRET`, then surface
the IDs as job output for an operator to paste into Railway. It must never run on
every push.

## Release ordering

Railway runs `preDeployCommand` (`prisma migrate deploy` + `prisma db seed`,
idempotent) before the new container takes traffic, then `startCommand`
(`pnpm start`). The seed upserts admin/issuer/empty tree/gate, so repeat deploys
are safe.
