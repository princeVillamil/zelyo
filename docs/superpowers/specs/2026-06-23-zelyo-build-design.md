# Zelyo — Build Design & Decisions (2026-06-23)

> This document captures the brainstorming outcome: the decisions and build decomposition that
> govern the implementation plan. It does **not** re-specify the product — `SPEC.md` is the
> authoritative build contract, `BRAND.md` the design system, `AGENT.md` the engineering rules.
> When those disagree on security, the stricter rule wins (per `AGENT.md §0`).

---

## 1. Decisions taken

| Decision | Choice | Consequence |
|---|---|---|
| **Scope** | Everything — Must + Should + Could | Spine (mint→prove→verify→nullifier block) + the three demo reveals + revocation, verifier-chosen trusted issuers, and a range/date predicate. "Won't" items from `SPEC.md §1` stay out. |
| **On-chain ZK verification** | Spike-first with a documented fallback | A Phase 0 feasibility spike proves out on-chain verification before any UI/services depend on it. A decision gate selects the path and records the outcome. |
| **Plan delivery** | Phased milestones with verification gates | One plan, ordered phases, each ending at a gate that must pass before the next begins. Matches `executing-plans`. |

## 2. The central risk and its fallback

The architecture in `SPEC.md §3/§6` assumes the target Stellar testnet protocol exposes the host
functions needed to verify a Noir/UltraHonk proof on-chain (BN254 pairing + Poseidon) via a reused
verifier. This is the single largest technical unknown; everything downstream is wiring.

**Phase 0 spike** answers it with a minimal circuit (Merkle inclusion + nullifier only) compiled,
proven, and submitted to a Soroban contract on testnet. The decision gate:

- **Path A — on-chain verification viable (preferred).** The `CredentialRegistry` contract verifies
  the proof itself (reused verifier / host fns), then enforces root validity, address binding, and
  nullifier uniqueness. This is the full "trustless verification" story in `SPEC.md`.
- **Path B — fallback if on-chain verification is not viable today.** The server verifies the proof
  off-chain (bb.js / `nargo` verify), and Soroban is used as the **root + nullifier registry**:
  `register(nullifier, root, boundAddress)` still enforces nullifier uniqueness and root validity
  on-chain, still emits `Verified`, still produces the on-chain tx for the explorer reveal.

**Acceptance criteria hold under both paths.** The three demo reveals (`SPEC.md §13`) — nothing
personal on-chain, live Sybil block (duplicate nullifier rejected on-chain), and selective-disclosure
unlock — remain true in Path B. Only the *location* of proof verification differs; privacy,
Sybil-resistance, and the on-chain nullifier remain intact. The plan is written so Phases 4–7 depend
on a stable service interface (`verifyAndRegister`) whose implementation swaps between A and B without
rippling into the UI.

## 3. Build decomposition (8 phases)

Each phase ends at a verification gate (typecheck + lint + the phase's tests green; see `AGENT.md §9`).

- **Phase 0 — Foundation & ZK feasibility spike.** pnpm workspace scaffold (`apps/web`,
  `circuits/`, `contracts/`, `packages/zk-shared`), `docker-compose` (postgres/redis/minio),
  `.env.example`, typed `env.ts`. Install `noirup`/`nargo`, Rust + `soroban-sdk`, Stellar CLI. Run the
  spike and the decision gate (§2). Stand up the **Poseidon parity harness** (JS leaf == circuit leaf,
  fixed vectors) — correctness-critical, built before anything relies on leaf math.

- **Phase 1 — ZK circuit (full).** Depth-20 Merkle inclusion, selective disclosure (`track`),
  `nullifier = Poseidon(s, scope)`, address binding, plus the Could range/date predicate. Compile,
  export ACIR + ABI to `apps/web/public/circuit/`, generate the verification key at build time.
  `zk-shared` leaf/nullifier builders + parity tests green.

- **Phase 2 — Soroban contracts.** `CredentialRegistry`: `set_root` (issuer-only),
  `verify_and_register` (path A) / `register` (path B), nullifier set; plus Could revocation
  (root update invalidates old proofs) and verifier-chosen trusted issuers. Rust unit tests: happy
  path, duplicate-nullifier revert (`NullifierUsed`), unknown-root revert, address binding. Deploy to
  testnet; write contract IDs to env.

- **Phase 3 — Web foundation & auth.** Next.js 16 App Router + Tailwind v4 CSS-first theme (full
  `BRAND.md` token set, self-hosted fonts, signature components: foil-stamp button, typewriter log,
  ledger lines, schematic illustration, registry cards). Prisma schema + migrations + idempotent seed
  (admin, issuer, empty depth-20 tree, `data-engineering` gate). Auth.js v5 Credentials + argon2id +
  JWT + middleware RBAC. Core libs: db, redis, pino logger, stellar client, S3 storage, `AppError`
  boundary, `rate-limiter-flexible`.

- **Phase 4 — Mint flow (issuer).** Issuer portal pages (`/issuer`, `/issuer/mint`,
  `/issuer/credentials`) + `POST /api/issuer/credentials`: resolve commitment → build leaf →
  `@zk-kit/imt` insert → publish root on-chain (`ISSUER_SECRET`) → persist `Credential`/`Leaf`/
  `RootHistory` → write VC JSON to storage → stream the mint log over SSE. Merkle + credential
  services in `src/server/`.

- **Phase 5 — Holder wallet + prove/verify.** Wallet pages (`/wallet`, `/wallet/credentials/[id]`,
  `/wallet/prove/[id]`, `/wallet/keys`). Client-only secret `s` (WebCrypto generation, IndexedDB
  encrypted store, user-exportable backup; never transmitted). In-browser proving (`noir_js` +
  `bb.js`) behind COOP/COEP headers. `POST /api/verify` → `verifyAndRegister` service (A or B) →
  `/verify/result/[txHash]`. Selective-disclosure toggles + Stellar address binding.

- **Phase 6 — Reveals & money-rails (the wow layer).** `/verify/result/[txHash]` explorer reveal
  panel (links out, asserts only nullifier + proof on-chain). Live Sybil-block UX (second submit →
  `NULLIFIER_USED`). Public job board (`/jobs`, `/jobs/[slug]`) + gate claim + Stellar
  claimable-balance / flag unlock recorded as `GateClaim`.

- **Phase 7 — Hardening, tests, deploy.** Security headers/CSP in `next.config.ts`, rate limits and
  audit logging across mutating endpoints, PII/secret redaction verified. Playwright e2e of the three
  reveals + auth/role redirects against the docker-compose stack. Full Vitest + Rust + e2e suite,
  `pnpm audit`. Railway deploy config (web build/release/start, COOP/COEP in prod, secrets as
  variables).

## 4. Sequencing rationale

- The hardest, most uncertain work (on-chain verification, Poseidon parity) is front-loaded into
  Phase 0 so a failure there reshapes the plan early rather than late.
- The spine (Must) is delivered across Phases 1–5; the three reveals (Should) in Phase 6; Could items
  fold into Phases 1–2 where they are cheap extensions of work already in flight (`AGENT.md §0`:
  "ship the spine first, then the wow layer — don't gold-plate cut items," so Could items are scoped
  as additive, not blocking).
- Phases 4–7 program against the stable `verifyAndRegister` service interface, insulating the UI from
  the Path A/B decision.

## 5. Out of scope

Everything under `SPEC.md §1` "Won't": in-circuit issuer signatures, BBS+/JWP, full W3C VC / OID4VC
wallet interop, multi-tenant issuer onboarding/billing, HSM/KMS key management.
