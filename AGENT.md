# AGENT.md — Engineering Guide for the Zelyo Coding Agent

You are building **Zelyo**: ZK-backed verifiable credentials on Stellar. Read `SPEC.md` (what to build) and `BRAND.md` (how it looks) first. This file is **how to build it well and safely**. When `SPEC.md` and this file disagree on security, the stricter rule wins.

---

## 0. Operating principles
- **Privacy is the product.** Personal data never goes on-chain. The holder secret `s` never leaves the browser. The server only ever sees `id_commitment = Poseidon(s)` and nullifiers.
- **The chain is the source of truth** for nullifier uniqueness and root validity. Postgres is a mirror for UX; never let the mirror authorize anything.
- **Ship the spine first** (mint → prove → verify → nullifier block), then the wow layer. Don't gold-plate cut items.
- **Latest stable dependencies.** Resolve the newest stable at install time; pin exact versions in the lockfile. Never introduce an unmaintained or deprecated package without flagging it.

---

## 1. Tech stack (pin latest; floor versions)
Node 22 LTS · pnpm 10 · Next.js 16.2.x (App Router) · React 19.2.x · TypeScript 6.x (strict) · Tailwind v4.3.x (`@tailwindcss/postcss`, `@tailwindcss/forms`) · Prisma 7.8.x · Postgres 16 · Auth.js v5 (`next-auth@5-beta`) + `@auth/prisma-adapter` · Zod 4.x · react-hook-form 7.x · `@node-rs/argon2` 2.x · `ioredis` 5.x + `rate-limiter-flexible` 11.x · `@aws-sdk/client-s3` 3.x (prod) / `minio` 8.x (dev) · `pino` 10.x / `pino-http` 11.x · Noir 1.0.0-beta.22 (`nargo` via `noirup`) · `@noir-lang/noir_js` + `@aztec/bb.js` 4.3.x · `@stellar/stellar-sdk` 16.x · Rust `soroban-sdk` (latest) + Stellar CLI (latest) · Vitest 4.x + Playwright 1.x · ESLint 10.x + Prettier 3.x.

Verify with `pnpm view <pkg> version` / `npm view <pkg> version` before pinning.

---

## 2. Project conventions
- Monorepo via **pnpm workspaces** (`apps/web`, `circuits/`, `contracts/`, `packages/zk-shared`). See `SPEC.md §4`.
- TypeScript `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. No `any`; use `unknown` + Zod at boundaries.
- **Validate every external input with Zod** (route bodies, query, env). Parse `process.env` once through a typed schema in `src/lib/env.ts`; fail fast on boot.
- Server-only modules carry `import "server-only";`. Never import secrets into client components. Anything reaching the browser is non-secret and may be `NEXT_PUBLIC_*`.
- Route handlers are thin: validate → authorize → call a service in `src/server/*` → map result to a typed response. Business logic lives in services, not handlers.
- Errors: throw typed `AppError(code, httpStatus, publicMessage)`; a single error boundary maps to `{ error: { code, message } }`. Never return stack traces or DB errors to clients.
- Logging: structured `pino`; **redact** secrets/PII (`authorization`, `password`, `set-cookie`, `s`, attributes). Log a request id; never log the holder secret or raw attributes.
- Commits: Conventional Commits. Small PRs. Every PR: typecheck + lint + unit tests green.

---

## 3. Commands
```bash
pnpm i                         # install
docker compose up -d           # postgres, redis, minio
pnpm prisma migrate dev        # apply migrations
pnpm prisma db seed            # seed admin + issuer + demo gate
pnpm zk:build                  # nargo compile → copy artifact to apps/web/public/circuit
pnpm contracts:build           # stellar contract build (optimizes by default)
pnpm contracts:deploy          # deploy registry + verifier to testnet, write IDs to .env
pnpm dev                       # next dev
pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e
```

---

## 4. Security best practices (mandatory)

### Authentication & sessions
- Auth.js v5 Credentials provider, **JWT session** (Credentials requires JWT). Cookies `httpOnly`, `secure` in prod, `sameSite=lax`. `AUTH_SECRET` ≥ 32 bytes from env.
- Passwords: **argon2id** via `@node-rs/argon2`, sensible memory/time cost. Never log or store plaintext. Enforce a minimum length/strength on register.
- RBAC enforced in **middleware and again in every handler** (`ADMIN` for `/issuer/**`, `HOLDER` for `/wallet/**`). Never trust client-sent role.
- Generic auth errors ("invalid credentials") — don't reveal which field failed. Rate-limit and add small constant-time delay on login.

### Input, output, injection
- Zod-validate and size-bound all inputs. Prisma only (parameterized) — no raw SQL string interpolation. If `queryRaw` is ever needed, use tagged-template parameters.
- React auto-escapes; never `dangerouslySetInnerHTML` with user data. Validate that uploaded VC files are JSON of the expected shape; reject anything else.

### Secrets & keys
- `ISSUER_SECRET` (publishes roots, deploys) and any signing key are **server-only**, from env/Railway vars — never bundled, never `NEXT_PUBLIC_`, never logged. Prefer a dedicated low-value testnet key.
- The **holder secret `s`** is generated with WebCrypto in the browser, stored encrypted (IndexedDB) + user-exportable backup, and **never transmitted**. The server rejects any payload that would contain `s`.
- `.env` is gitignored; commit only `.env.example`. Rotate any secret that touches a log or a screenshot.

### Transport, headers, CSRF
- HTTPS everywhere (Railway default; set HSTS). Security headers in `next.config.ts`: `Content-Security-Policy` (no `unsafe-inline` for scripts; allow the font/origin you actually use), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` minimal.
- CSRF: Auth.js protects its routes; for other mutating routes rely on `sameSite` cookies **and** verify `Origin`/`Host`. Prefer POST + JSON (not form GET) for mutations.

### Rate limiting & abuse
- `rate-limiter-flexible` + Redis on `/api/auth/*`, `/api/verify`, `/api/holder/register`, `/api/jobboard/*/claim`. Key by IP (+ user where available). Return `429` with `Retry-After`.

### Data protection
- Attributes (name/grade) are PII held off-chain in Postgres — access-controlled to the owning holder and the issuing admin only. Never include them in on-chain calls, logs, analytics, or client bundles. Object-storage bucket is **private**; serve VC files via short-lived signed URLs.
- Audit-log sensitive actions (mint, revoke, verify) to `AuditLog` with actor + ip; never log secrets/PII values.

### Dependencies & supply chain
- `pnpm i --frozen-lockfile` in CI. Run `pnpm audit` (or equivalent) and address criticals. Pin versions; review transitive changes. Don't add a dependency you can't justify.

---

## 5. ZK & Stellar specifics
- **Poseidon parity is correctness-critical.** The JS leaf/nullifier builders in `packages/zk-shared` must output the **exact** field elements the Noir circuit computes (same Poseidon params over BN254). Prefer computing leaves through a shared WASM / the circuit itself; add a parity test with fixed vectors that fails CI on drift.
- **bb.js needs cross-origin isolation.** Barretenberg uses WASM threads (`SharedArrayBuffer`). Set on the app (and the routes serving the prover/artifacts):
  `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. Without these, in-browser proving silently fails. Test in a real browser, not just SSR.
- Generate the verification key at build time and wire it into the verifier contract; the `scope` must match between client (`ZK_SCOPE_APP_ID` + chain id + registry id) and contract.
- Bind the proof to `bound_address` and have the contract assert it equals the invoker to stop mempool replay. The contract checks: proof valid → root ∈ valid set → address bound → nullifier unused → store nullifier → emit `Verified`. Duplicate nullifier reverts (`NullifierUsed`) — that revert **is** the Sybil block; surface it cleanly in the UI.
- Use `@stellar/stellar-sdk` for RPC/contract calls; keep all signing server-side except the holder's own wallet interactions. Fund testnet accounts via Friendbot in dev only.

---

## 6. Frontend
- Tailwind v4 CSS-first (`@theme` in `globals.css`) — see `BRAND.md §11`. Don't reintroduce a `tailwind.config.js` unless a plugin requires it.
- Server Components by default; Client Components only where interactivity/WASM is needed (`/wallet/prove/*`, disclosure toggles, mint log). The prover and any code touching `s` are client-only.
- Forms: react-hook-form + Zod resolver; mirror the same Zod schema server-side. Accessible labels, visible focus, reduced-motion support (`BRAND.md §10`).
- Stream mint/prove logs to the typewriter component (SSE or polling). Keep one foil-stamp CTA per view.

---

## 7. Testing
- **Unit (Vitest):** Poseidon parity, leaf/Merkle math, nullifier derivation, Zod schemas, auth `authorize()`, RBAC helpers.
- **Contract:** Rust unit tests for `verify_and_register` happy path + duplicate-nullifier revert + unknown-root revert + address-binding.
- **E2E (Playwright):** the three acceptance reveals (nothing-on-chain link, Sybil block on second submit, selective-disclosure unlock), plus auth/role redirects. Run against the docker-compose stack.

---

## 8. Version-specific gotchas
- **Rust 1.91.0** has known wasm build issues and is blocked by the Stellar CLI for contract builds — use a compatible toolchain version for `contracts:build`.
- **Stellar CLI** now optimizes wasm on `stellar contract build` by default (no `--optimize` needed).
- **Next.js 16 / React 19:** async request APIs (`cookies()`, `headers()`, `params`) — await them. Use `next.config.ts`. Set the COOP/COEP + security headers there.
- **Prisma 7:** run `prisma generate` post-install and in the Railway build; use `directUrl` for migrations against pooled connections.
- **Auth.js v5:** config in `auth.ts` exporting `handlers/auth/signIn/signOut`; Credentials ⇒ JWT sessions; put `role`/`userId` in the token + session callbacks.
- **Tailwind v4:** no JS config by default; `@plugin "@tailwindcss/forms"`; tokens override defaults (e.g. `rounded-full` = 0.75rem per `BRAND.md`).
- **Zod 4:** import from `zod`; note v4 API differences if reusing older snippets.

---

## 9. Definition of done
A change is done when: it builds; `typecheck`, `lint`, unit + relevant e2e pass; inputs are Zod-validated; the route is RBAC-guarded and rate-limited where mutating; no secret/PII is logged or shipped to the client; new env vars are in `.env.example` and `src/lib/env.ts`; and it visibly matches `BRAND.md`. For ZK/contract changes, the Poseidon parity test and the duplicate-nullifier revert test pass.
