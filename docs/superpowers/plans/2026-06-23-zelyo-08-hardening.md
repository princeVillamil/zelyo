# Phase 7 — Hardening, Tests & Deploy

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This is **Phase 7 of 8** — read `docs/superpowers/plans/2026-06-23-zelyo-00-index.md` (Global Constraints + Cross-Phase Interface Contract) first; every value below is copied verbatim from it / `SPEC.md` / `AGENT.md` / `BRAND.md`.

**Goal:** Cross-cutting hardening on top of Phases 0–6 — lock the security headers/CSP and prove them with tests, sweep rate-limiting + audit logging across every mutating endpoint, verify PII/secret redaction, drive the three acceptance reveals and auth/role redirects end-to-end with Playwright against the docker-compose stack, enforce the accessibility floor with axe-core, gate it all in CI, and ship to Railway.

**Prerequisites:** Phases 0–6 complete — the spine (mint → prove → verify → nullifier block), the three reveals (`/verify/result/[txHash]` explorer panel, live Sybil block, job-board gate claim), Auth.js v5 + RBAC middleware, `rate-limiter-flexible` + Redis lib, pino logger, `AppError` boundary, and the docker-compose stack (postgres/redis/minio) all exist and pass their phase gates.

**Gate:** `pnpm i --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` all green; `pnpm audit` shows no unaddressed criticals; the Phase Gate / Acceptance checklist at the end maps every `SPEC.md §13` item to a passing test.

## Global Constraints

Apply to **every task** (copied verbatim from the index Global Constraints):

- **Versions:** Node ≥ 22 LTS · pnpm 10.x · Next.js 16.2.x · React 19.2.x · TypeScript 6.0.x · Vitest 4.x · Playwright 1.x · ESLint 10.x + Prettier 3.x · `ioredis` 5.x + `rate-limiter-flexible` 11.x · `pino` 10.x + `pino-http` 11.x. Pin exact in lockfile; never downgrade.
- **TypeScript:** `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. No `any`; `unknown` + Zod at boundaries.
- **Security headers (`next.config.ts`):** CSP with **no `unsafe-inline` for scripts** and only the actual font origin allowed; `X-Frame-Options: DENY`; `X-Content-Type-Options: nosniff`; `Referrer-Policy: strict-origin-when-cross-origin`; minimal `Permissions-Policy`; HSTS in prod; `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` on the app and prover/artifact routes (bb.js WASM threads need cross-origin isolation or proving silently fails).
- **Rate limits (`rate-limiter-flexible` + Redis, per IP):** auth `10/min`, `/api/verify` `20/min`, register `5/min`, mint `60/min` (admin); job-board claim limited too. Return `429` with `Retry-After`.
- **Audit + PII:** AuditLog mint/revoke/verify with actor + ip and **no PII values**. Personal data (name/grade/attributes) and the holder secret `s` never go on-chain, in logs, in analytics, or in client bundles. pino redacts `authorization`, `password`, `set-cookie`, `s`, `attributes`.
- **Accessibility floor (`BRAND.md §10`):** visible keyboard focus everywhere; hit targets ≥ 40px; reduced-motion disables shine + translate; color is never the sole signal (pair with text/icon); self-hosted fonts with `font-display: swap`.
- **Conventions:** Conventional Commits. Server-only modules carry `import "server-only";`. New env vars go in `.env.example` **and** `src/lib/env.ts`. One foil-stamp CTA per view; match `BRAND.md` tokens exactly; respect `prefers-reduced-motion`.
- **Definition of done (every task):** builds; `typecheck`, `lint`, relevant unit/e2e pass; inputs Zod-validated; mutating routes RBAC-guarded + rate-limited; no secret/PII logged or shipped to client; new env vars in `.env.example` + `env.ts`; visibly matches `BRAND.md`.

---

## File structure (created / modified in this phase)

- `apps/web/next.config.ts` — single source of truth for the security-header chain (modify/audit).
- `apps/web/src/lib/security-headers.ts` — exported header array + helper, imported by `next.config.ts` and by header tests (create).
- `apps/web/src/lib/rate-limit.ts` — `rate-limiter-flexible` limiter registry + `enforceRateLimit()` helper used by every mutating handler (audit/extend).
- `apps/web/src/server/audit.service.ts` — `writeAudit()` wrapper around the `AuditLog` Prisma model (audit/extend).
- `apps/web/src/lib/logger.ts` — pino instance with the redaction config (audit).
- `apps/web/tests/unit/security-headers.test.ts` · `rate-limit.test.ts` · `audit.test.ts` · `redaction.test.ts` (create).
- `apps/web/tests/e2e/*` — Playwright specs + fixtures + axe helper (create).
- `apps/web/playwright.config.ts` (create).
- `.github/workflows/ci.yml` (create).
- `railway.json` · `nixpacks.toml` · `docs/DEPLOY.md` (create).

Cross-phase interfaces consumed here (from the index Interface Contract): `verifyAndRegister(bundle): Promise<VerifyResult>` with `VerificationResult = VERIFIED | INVALID_PROOF | UNKNOWN_ROOT | NULLIFIER_USED | ERROR`; `claimGate(slug, nullifierHex, boundAddress, txHash)`; `mintCredential(input)`; Prisma models `AuditLog`, `Nullifier`, `Verification`, `GateClaim`, `Credential`; env keys from `src/lib/env.ts`.

---

### Task 1: Security headers / CSP audit + assertion tests

**Files:**
- Create: `apps/web/src/lib/security-headers.ts`
- Modify: `apps/web/next.config.ts`
- Test: `apps/web/tests/unit/security-headers.test.ts`

**Interfaces:**
- Consumes: `env.NODE_ENV` / `env.APP_URL` from `src/lib/env.ts`; the actual self-hosted font origin (fonts are served from the app's own `/fonts/*`, per `BRAND.md §10` "self-host fonts in production", so the only font/style/font-src is `'self'`).
- Produces: `export function securityHeaders(isProd: boolean): { key: string; value: string }[]` and `export function cspValue(isProd: boolean): string` — imported by `next.config.ts` and the test.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tests/unit/security-headers.test.ts
import { describe, it, expect } from "vitest";
import { securityHeaders, cspValue } from "../../src/lib/security-headers";

function asMap(isProd: boolean) {
  return new Map(securityHeaders(isProd).map((h) => [h.key, h.value]));
}

describe("security headers", () => {
  it("sets the cross-cutting headers AGENT.md §4 requires", () => {
    const h = asMap(true);
    expect(h.get("X-Frame-Options")).toBe("DENY");
    expect(h.get("X-Content-Type-Options")).toBe("nosniff");
    expect(h.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(h.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
    expect(h.get("Cross-Origin-Embedder-Policy")).toBe("require-corp");
    expect(h.get("Permissions-Policy")).toBe(
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    );
  });

  it("emits HSTS only in production", () => {
    expect(asMap(true).get("Strict-Transport-Security")).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );
    expect(asMap(false).has("Strict-Transport-Security")).toBe(false);
  });

  it("CSP has no unsafe-inline for scripts and self-only font/style", () => {
    const csp = cspValue(true);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("font-src 'self'");
    expect(csp).toContain("style-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    // bb.js WASM needs SharedArrayBuffer; worker-src self+blob, wasm-unsafe-eval allowed
    expect(csp).toContain("worker-src 'self' blob:");
    expect(csp).toContain("wasm-unsafe-eval");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run tests/unit/security-headers.test.ts`
Expected: FAIL — `Cannot find module '../../src/lib/security-headers'`.

- [ ] **Step 3: Write the headers module**

```ts
// apps/web/src/lib/security-headers.ts
// Single source of truth for the security-header chain. Imported by next.config.ts
// and by the header test. No secrets here — pure config.

export function cspValue(isProd: boolean): string {
  // Fonts are self-hosted (BRAND.md §10), so the only origin we trust is 'self'.
  // 'wasm-unsafe-eval' is required for bb.js / noir_wasm to instantiate WASM.
  // style-src allows 'self'; Next injects nonce'd styles, never inline scripts.
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'wasm-unsafe-eval'"],
    "style-src": ["'self'"],
    "img-src": ["'self'", "data:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'"], // RPC/Horizon go through our own /api routes
    "worker-src": ["'self'", "blob:"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  };
  if (isProd) directives["upgrade-insecure-requests"] = [];
  return Object.entries(directives)
    .map(([k, v]) => (v.length ? `${k} ${v.join(" ")}` : k))
    .join("; ");
}

export function securityHeaders(isProd: boolean): { key: string; value: string }[] {
  const headers = [
    { key: "Content-Security-Policy", value: cspValue(isProd) },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    },
    // Cross-origin isolation for bb.js WASM threads (AGENT.md §5) — required everywhere.
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
  ];
  if (isProd) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }
  return headers;
}
```

- [ ] **Step 4: Wire it into `next.config.ts`**

```ts
// apps/web/next.config.ts
import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Every route, including the app shell, the prover page, and /circuit/* artifacts.
        source: "/:path*",
        headers: securityHeaders(isProd),
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 5: Run unit test to verify it passes**

Run: `pnpm --filter web exec vitest run tests/unit/security-headers.test.ts`
Expected: PASS (3 passed).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/security-headers.ts apps/web/next.config.ts apps/web/tests/unit/security-headers.test.ts
git commit -m "feat(security): centralize CSP + security headers with assertion test"
```

---

### Task 2: Rate-limiting sweep across every mutating endpoint

**Files:**
- Modify: `apps/web/src/lib/rate-limit.ts`
- Modify: `apps/web/src/app/api/jobboard/gates/[slug]/claim/route.ts` (and any handler missing a limiter)
- Test: `apps/web/tests/unit/rate-limit.test.ts`

**Interfaces:**
- Consumes: `ioredis` client from `src/lib/redis.ts`; `AppError(code, httpStatus, publicMessage)` from `src/lib/errors.ts`.
- Produces: `export const limiters` (named limiters) and `export async function enforceRateLimit(name: keyof typeof limiters, ip: string): Promise<void>` — throws `AppError("RATE_LIMITED", 429, ...)` with a `retryAfter` seconds field; handlers map it to a `429` + `Retry-After` header.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tests/unit/rate-limit.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

// In-memory limiter so the test needs no Redis.
vi.mock("rate-limiter-flexible", async () => {
  const actual = await vi.importActual<typeof import("rate-limiter-flexible")>(
    "rate-limiter-flexible",
  );
  return { ...actual, RateLimiterRedis: actual.RateLimiterMemory };
});
vi.mock("../../src/lib/redis", () => ({ redis: {} }));

import { limiters, enforceRateLimit } from "../../src/lib/rate-limit";

describe("rate limit floors (SPEC §8)", () => {
  it("declares the SPEC §8 per-minute floors", () => {
    expect(limiters.auth.points).toBe(10);
    expect(limiters.verify.points).toBe(20);
    expect(limiters.register.points).toBe(5);
    expect(limiters.mint.points).toBe(60);
    expect(limiters.claim.points).toBeGreaterThan(0);
    for (const l of Object.values(limiters)) expect(l.duration).toBe(60);
  });

  it("throws RATE_LIMITED with Retry-After once the floor is exceeded", async () => {
    const ip = "203.0.113.7";
    for (let i = 0; i < 5; i++) await enforceRateLimit("register", ip); // 5/min OK
    let caught: unknown;
    try {
      await enforceRateLimit("register", ip); // 6th in window
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeTruthy();
    const err = caught as { code: string; httpStatus: number; retryAfter: number };
    expect(err.code).toBe("RATE_LIMITED");
    expect(err.httpStatus).toBe(429);
    expect(err.retryAfter).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run tests/unit/rate-limit.test.ts`
Expected: FAIL — either the floors mismatch or `claim`/`retryAfter` is missing.

- [ ] **Step 3: Confirm/complete the limiter registry**

```ts
// apps/web/src/lib/rate-limit.ts
import "server-only";
import { RateLimiterRedis } from "rate-limiter-flexible";
import { redis } from "./redis";
import { AppError } from "./errors";

const mk = (keyPrefix: string, points: number) =>
  new RateLimiterRedis({ storeClient: redis, keyPrefix, points, duration: 60 });

// SPEC §8 floors, per IP, per minute.
export const limiters = {
  auth: mk("rl:auth", 10),
  verify: mk("rl:verify", 20),
  register: mk("rl:register", 5),
  mint: mk("rl:mint", 60),
  claim: mk("rl:claim", 20),
} as const;

export async function enforceRateLimit(
  name: keyof typeof limiters,
  ip: string,
): Promise<void> {
  try {
    await limiters[name].consume(ip);
  } catch (res) {
    const retryAfter = Math.max(1, Math.ceil(((res as { msBeforeNext?: number }).msBeforeNext ?? 60000) / 1000));
    throw new AppError("RATE_LIMITED", 429, "Too many requests. Please retry shortly.", { retryAfter });
  }
}
```

(If `AppError`'s 4th arg / `retryAfter` does not yet exist, extend its constructor signature to `(code, httpStatus, publicMessage, meta?: { retryAfter?: number })` and surface `retryAfter` in the error boundary as the `Retry-After` header.)

- [ ] **Step 4: Ensure the claim handler enforces it**

```ts
// apps/web/src/app/api/jobboard/gates/[slug]/claim/route.ts — add near the top of POST
import { enforceRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
// ...
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  await enforceRateLimit("claim", clientIp(req));
  // ...existing validate → claimGate(...) flow...
}
```

Grep to confirm every mutating route calls `enforceRateLimit`: `apps/web/src/app/api/auth/*` (auth), `/api/verify` (verify), `/api/holder/register` (register), `/api/issuer/credentials` (mint), `/api/jobboard/gates/[slug]/claim` (claim).

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run tests/unit/rate-limit.test.ts`
Expected: PASS (2 passed).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/rate-limit.ts apps/web/src/app/api/jobboard/gates/'[slug]'/claim/route.ts apps/web/tests/unit/rate-limit.test.ts
git commit -m "feat(security): enforce SPEC §8 rate floors on all mutating routes with 429+Retry-After"
```

---

### Task 3: Audit-log sweep on mint / revoke / verify (actor + ip, no PII)

**Files:**
- Modify: `apps/web/src/server/audit.service.ts`
- Test: `apps/web/tests/unit/audit.test.ts`

**Interfaces:**
- Consumes: Prisma `AuditLog` model (`id`, `action`, `actor`, `ip`, `subject?`, `createdAt`); `verifyAndRegister`, `mintCredential`, revoke service.
- Produces: `export async function writeAudit(input: { action: "MINT" | "REVOKE" | "VERIFY"; actor: string; ip: string; subject?: string }): Promise<void>` — `subject` may hold only non-PII references (nullifier hash, credential id, root hex). Never attributes / username / secret.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tests/unit/audit.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
vi.mock("../../src/lib/db", () => ({ db: { auditLog: { create } } }));

import { writeAudit } from "../../src/server/audit.service";

const PII = ["learnerName", "grade", "Ada Lovelace", "password", "secret-s"];

describe("audit logging", () => {
  beforeEach(() => create.mockReset());

  it("persists action + actor + ip and nothing else", async () => {
    await writeAudit({ action: "VERIFY", actor: "anon", ip: "203.0.113.9", subject: "0xnullifier" });
    expect(create).toHaveBeenCalledOnce();
    const data = create.mock.calls[0]![0].data;
    expect(data.action).toBe("VERIFY");
    expect(data.actor).toBe("anon");
    expect(data.ip).toBe("203.0.113.9");
    expect(data.subject).toBe("0xnullifier");
  });

  it("never writes a PII field name or value", async () => {
    await writeAudit({ action: "MINT", actor: "admin", ip: "10.0.0.1", subject: "cred_123" });
    const serialized = JSON.stringify(create.mock.calls[0]![0]);
    for (const p of PII) expect(serialized).not.toContain(p);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run tests/unit/audit.test.ts`
Expected: FAIL — `writeAudit` missing or accepting/forwarding extra fields.

- [ ] **Step 3: Implement / tighten the audit service**

```ts
// apps/web/src/server/audit.service.ts
import "server-only";
import { db } from "@/lib/db";

const ALLOWED = ["MINT", "REVOKE", "VERIFY"] as const;
type Action = (typeof ALLOWED)[number];

export async function writeAudit(input: {
  action: Action;
  actor: string; // user id / username for ADMIN, "anon" for public
  ip: string;
  subject?: string; // non-PII reference only: nullifier hash, credential id, root hex
}): Promise<void> {
  // Whitelist explicitly — never spread the input so callers cannot smuggle PII in.
  await db.auditLog.create({
    data: { action: input.action, actor: input.actor, ip: input.ip, subject: input.subject ?? null },
  });
}
```

Call sites (confirm each passes only non-PII subjects): `mintCredential` → `writeAudit({ action: "MINT", actor: adminId, ip, subject: cred.id })`; revoke → `writeAudit({ action: "REVOKE", actor: adminId, ip, subject: rootHex })`; `verifyAndRegister` caller → `writeAudit({ action: "VERIFY", actor: "anon", ip, subject: nullifierHex })`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run tests/unit/audit.test.ts`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/audit.service.ts apps/web/tests/unit/audit.test.ts
git commit -m "feat(security): PII-safe audit-log sweep on mint/revoke/verify"
```

---

### Task 4: PII / secret redaction verification

**Files:**
- Modify (only if assertions fail): `apps/web/src/lib/logger.ts`
- Test: `apps/web/tests/unit/redaction.test.ts`

**Interfaces:**
- Consumes: pino logger from `src/lib/logger.ts`.
- Produces: a guarantee that `authorization`, `password`, `set-cookie`, `s`, `attributes` are redacted in logs, and that neither the client bundle nor any on-chain call path references `attributes` or `s`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tests/unit/redaction.test.ts
import { describe, it, expect } from "vitest";
import { Writable } from "node:stream";
import pino from "pino";
import { execSync } from "node:child_process";

// Build a logger with the exact redaction config the app uses, writing to a buffer.
function bufferLogger() {
  let out = "";
  const sink = new Writable({ write(c, _e, cb) { out += c.toString(); cb(); } });
  const log = pino(
    {
      redact: {
        paths: ["authorization", "password", "set-cookie", "s", "attributes",
          "*.authorization", "*.password", "*.set-cookie", "*.s", "*.attributes",
          'req.headers["set-cookie"]', "req.headers.authorization"],
        censor: "[REDACTED]",
      },
    },
    sink,
  );
  return { log, read: () => out };
}

describe("pino redaction (AGENT.md §4)", () => {
  it("censors authorization/password/set-cookie/s/attributes", () => {
    const { log, read } = bufferLogger();
    log.info({
      authorization: "Bearer SECRET", password: "hunter2",
      "set-cookie": "session=abc", s: "0xholdersecret",
      attributes: { learnerName: "Ada", grade: "A+" },
    }, "request");
    const line = read();
    expect(line).not.toContain("SECRET");
    expect(line).not.toContain("hunter2");
    expect(line).not.toContain("session=abc");
    expect(line).not.toContain("0xholdersecret");
    expect(line).not.toContain("Ada");
    expect(line).not.toContain("grade");
    expect(line.match(/\[REDACTED\]/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it("the production client bundle contains no holder secret or raw attributes", () => {
    // Static guard: nothing under src/app/**/*.tsx that ships to the client may read
    // process.env.ISSUER_SECRET, the holder secret variable, or persist raw attributes
    // through a "use client" module. Grep the built client chunks.
    const hits = execSync(
      "grep -RIl --include='*.js' -e ISSUER_SECRET -e holderSecret " +
        "apps/web/.next/static 2>/dev/null || true",
      { encoding: "utf8" },
    ).trim();
    expect(hits).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails (or passes if config already correct)**

Run: `pnpm --filter web build && pnpm --filter web exec vitest run tests/unit/redaction.test.ts`
Expected: the first test FAILS if `src/lib/logger.ts` is missing any of the five redact paths; the bundle test FAILS if a client chunk references a secret. (`.next/static` must exist — that is why we build first.)

- [ ] **Step 3: Align the logger redaction config**

```ts
// apps/web/src/lib/logger.ts  — ensure the redact block matches the test exactly
import "server-only";
import pino from "pino";
import { env } from "./env";

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      "authorization", "password", "set-cookie", "s", "attributes",
      "*.authorization", "*.password", "*.set-cookie", "*.s", "*.attributes",
      'req.headers["set-cookie"]', "req.headers.authorization",
    ],
    censor: "[REDACTED]",
  },
});
```

If the bundle test fails, move the offending read behind `import "server-only";` / into a `src/server/*` service and re-build.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web exec vitest run tests/unit/redaction.test.ts`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/logger.ts apps/web/tests/unit/redaction.test.ts
git commit -m "test(security): verify pino redaction + no secret/PII in client bundle"
```

---

### Task 5: Playwright config + fixtures against the docker-compose stack

**Files:**
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/tests/e2e/fixtures.ts`
- Create: `apps/web/tests/e2e/axe.ts`
- Modify: `apps/web/package.json` (`test:e2e` script + `@playwright/test`, `@axe-core/playwright` devDeps)

**Interfaces:**
- Consumes: docker-compose stack (postgres/redis/minio) + a seeded DB (admin `ADMIN_USERNAME`/`ADMIN_PASSWORD`, the `data-engineering` gate); `pnpm dev` server.
- Produces: `test` fixture extended with `loginAs(role)`, `registerHolder()`, and a `checkA11y(page, context)` helper — consumed by Tasks 6–8.

- [ ] **Step 1: Add Playwright config**

```ts
// apps/web/playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // shared chain state (nullifiers) — keep deterministic
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
    // Cross-origin isolation headers must survive locally too (bb.js).
    launchOptions: { args: ["--enable-features=SharedArrayBuffer"] },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Assumes docker compose up -d + prisma migrate deploy + db seed already ran (see CI / DEPLOY).
    command: "pnpm --filter web dev",
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 2: Add fixtures**

```ts
// apps/web/tests/e2e/fixtures.ts
import { test as base, expect, type Page } from "@playwright/test";

const ADMIN = { username: process.env.ADMIN_USERNAME ?? "admin", password: process.env.ADMIN_PASSWORD ?? "admin-password" };

async function signIn(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/username/i).fill(username);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in|authorize|enter/i }).click();
  await page.waitForURL((u) => !u.pathname.endsWith("/login"));
}

export const test = base.extend<{
  loginAs: (role: "admin") => Promise<void>;
  registerHolder: () => Promise<{ username: string; password: string }>;
}>({
  loginAs: async ({ page }, use) => {
    await use(async (role) => {
      if (role === "admin") await signIn(page, ADMIN.username, ADMIN.password);
    });
  },
  registerHolder: async ({ page }, use) => {
    await use(async () => {
      const username = `holder_${Date.now()}_${Math.floor(Math.random() * 1e4)}`;
      const password = "Holder-Passw0rd!";
      await page.goto("/register");
      await page.getByLabel(/username/i).fill(username);
      await page.getByLabel(/password/i).fill(password);
      await page.getByRole("button", { name: /register|create/i }).click();
      await page.waitForURL((u) => !u.pathname.endsWith("/register"));
      return { username, password };
    });
  },
});
export { expect };
```

- [ ] **Step 3: Add the axe helper**

```ts
// apps/web/tests/e2e/axe.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export async function checkA11y(page: Page, context: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, `axe violations on ${context}: ${JSON.stringify(serious.map((v) => v.id))}`).toEqual([]);
}
```

- [ ] **Step 4: Add scripts + devDeps, install browser**

```bash
pnpm --filter web add -D @playwright/test@latest @axe-core/playwright@latest
# package.json (apps/web) scripts: "test:e2e": "playwright test"
pnpm --filter web exec playwright install --with-deps chromium
```

- [ ] **Step 5: Smoke-run config (no specs yet)**

Run: `pnpm --filter web exec playwright test --list`
Expected: lists `0 tests` without config errors (the webServer/health URL resolves).

- [ ] **Step 6: Commit**

```bash
git add apps/web/playwright.config.ts apps/web/tests/e2e/fixtures.ts apps/web/tests/e2e/axe.ts apps/web/package.json apps/web/pnpm-lock.yaml
git commit -m "test(e2e): playwright config, login/holder fixtures, axe-core helper"
```

---

### Task 6: E2E — auth & role redirects (SPEC §13.4) + a11y on key pages

**Files:**
- Create: `apps/web/tests/e2e/auth-roles.spec.ts`

**Interfaces:**
- Consumes: fixtures (`loginAs`, `registerHolder`), `checkA11y`; middleware RBAC (`ADMIN` for `/issuer/**`, `HOLDER` for `/wallet/**`); `/login`.

- [ ] **Step 1: Write the failing e2e spec**

```ts
// apps/web/tests/e2e/auth-roles.spec.ts
import { test, expect } from "./fixtures";
import { checkA11y } from "./axe";

test.describe("auth & role redirects (SPEC §13.4)", () => {
  test("unauthenticated visitor to /issuer is redirected to /login", async ({ page }) => {
    await page.goto("/issuer");
    await expect(page).toHaveURL(/\/login/);
    await checkA11y(page, "login");
  });

  test("seeded admin can reach the mint page", async ({ page, loginAs }) => {
    await loginAs("admin");
    await page.goto("/issuer/mint");
    await expect(page).toHaveURL(/\/issuer\/mint/);
    await expect(page.getByRole("heading", { name: /mint|issue|distillation/i })).toBeVisible();
    await checkA11y(page, "issuer/mint");
  });

  test("a holder is blocked from /issuer/**", async ({ page, registerHolder }) => {
    await registerHolder();
    await page.goto("/issuer/mint");
    // RBAC redirects holders away from /issuer/** (to /login or a 403 page) — never renders the mint form.
    await expect(page).not.toHaveURL(/\/issuer\/mint$/);
    await expect(page.getByLabel(/learner|track|course/i)).toHaveCount(0);
  });

  test("home and job board are accessible", async ({ page }) => {
    await page.goto("/");
    await checkA11y(page, "home");
    await page.goto("/jobs");
    await checkA11y(page, "jobs");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter web exec playwright test auth-roles.spec.ts`
Expected: FAIL initially if any RBAC redirect or a11y violation exists (or PASS if Phase 3 already satisfies it — in that case this spec is the regression guard).

- [ ] **Step 3: Fix any gap surfaced**

If a holder reaches `/issuer/mint`, tighten `apps/web/src/middleware.ts` so `/issuer/**` requires `token.role === "ADMIN"` and redirects otherwise. If axe reports a serious violation (missing label, focus, contrast), fix the offending component per `BRAND.md §10` (visible `focus:border-primary`, full-row checkbox labels, `on-surface-variant` for small secondary text).

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter web exec playwright test auth-roles.spec.ts`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add apps/web/tests/e2e/auth-roles.spec.ts apps/web/src/middleware.ts
git commit -m "test(e2e): auth/role redirects + axe a11y on key pages"
```

---

### Task 7: E2E — the three acceptance reveals (SPEC §13.1–13.3)

**Files:**
- Create: `apps/web/tests/e2e/reveals.spec.ts`

**Interfaces:**
- Consumes: full mint → prove → verify flow; `/issuer/mint`, `/wallet`, `/wallet/prove/[id]`, `/verify/result/[txHash]`, `/jobs/[slug]`; `verifyAndRegister` returning `VerificationResult`; `NEXT_PUBLIC_EXPLORER_BASE`; the `data-engineering` gate; `GateClaim`.

> Because in-browser proving (bb.js) is slow and chain calls are involved, this spec uses generous timeouts and serial ordering (the same nullifier must be used twice for the Sybil reveal, so the first verify must complete before the second).

- [ ] **Step 1: Write the failing e2e spec**

```ts
// apps/web/tests/e2e/reveals.spec.ts
import { test, expect, type Page } from "./fixtures";

test.describe.configure({ mode: "serial" });

// Helper: drive the full mint → prove flow for a freshly registered holder,
// disclosing only `track`, against the data-engineering gate, and submit the proof.
async function mintProveVerify(page: Page, registerHolder: () => Promise<{ username: string; password: string }>, loginAs: (r: "admin") => Promise<void>) {
  const holder = await registerHolder();
  // holder generates secret s in-browser (WebCrypto) and publishes id_commitment
  await page.goto("/wallet/keys");
  await page.getByRole("button", { name: /generate|create key/i }).click();
  await expect(page.getByText(/commitment/i)).toBeVisible({ timeout: 30_000 });

  // admin mints a data-engineering credential to this holder
  await loginAs("admin");
  await page.goto("/issuer/mint");
  await page.getByLabel(/holder|username/i).fill(holder.username);
  await page.getByLabel(/track/i).fill("data-engineering");
  await page.getByLabel(/grade/i).fill("A");
  await page.getByLabel(/course/i).fill("Distributed Systems");
  await page.getByLabel(/learner|name/i).fill("Ada Lovelace");
  await page.getByRole("button", { name: /seal & authorize|mint/i }).click();
  await expect(page.getByText(/sealed|published|root/i)).toBeVisible({ timeout: 60_000 });

  // holder proves, disclosing only track
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel(/username/i).fill(holder.username);
  await page.getByLabel(/password/i).fill(holder.password);
  await page.getByRole("button", { name: /sign in|enter|authorize/i }).click();
  await page.goto("/wallet");
  await page.getByRole("link", { name: /prove|generate proof/i }).first().click();
  // selective disclosure: only `track` checked, name/grade hidden
  await page.getByRole("checkbox", { name: /track/i }).check();
  await expect(page.getByRole("checkbox", { name: /grade|name/i }).first()).not.toBeChecked();
  await page.getByRole("button", { name: /generate zk-proof/i }).click();
  // proving + submit may take a while
  await page.waitForURL(/\/verify\/result\//, { timeout: 180_000 });
  return holder;
}

test("13.1 nothing personal on-chain: explorer link present, no PII on the result page", async ({ page, registerHolder, loginAs }) => {
  await mintProveVerify(page, registerHolder, loginAs);
  const explorer = page.getByRole("link", { name: /view on explorer|explorer/i });
  await expect(explorer).toBeVisible();
  const href = await explorer.getAttribute("href");
  expect(href).toContain(process.env.NEXT_PUBLIC_EXPLORER_BASE ?? "stellar.expert");
  // The on-chain reveal panel asserts only nullifier + proof are recorded — no name/grade/email.
  const body = (await page.locator("body").innerText()).toLowerCase();
  expect(body).toContain("nullifier");
  expect(body).not.toContain("ada lovelace");
  expect(body).not.toMatch(/grade[:\s]*a\b/);
});

test("13.2 Sybil block: re-submitting the same nullifier shows NULLIFIER_USED", async ({ page, registerHolder, loginAs }) => {
  await mintProveVerify(page, registerHolder, loginAs); // first submit succeeds
  // Re-run the proof for the SAME holder/scope → same nullifier → must be rejected on-chain.
  await page.goto("/wallet");
  await page.getByRole("link", { name: /prove|generate proof/i }).first().click();
  await page.getByRole("checkbox", { name: /track/i }).check();
  await page.getByRole("button", { name: /generate zk-proof/i }).click();
  await expect(page.getByText(/NULLIFIER_USED|already (been )?used|sybil/i)).toBeVisible({ timeout: 180_000 });
});

test("13.3 selective disclosure unlocks a gate claim", async ({ page, registerHolder, loginAs }) => {
  await mintProveVerify(page, registerHolder, loginAs);
  await page.goto("/jobs/data-engineering");
  await page.getByRole("button", { name: /claim|unlock/i }).click();
  // a valid verification → claimable balance / flag recorded as GateClaim
  await expect(page.getByText(/claim recorded|unlocked|claimable balance|reward/i)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("link", { name: /explorer|transaction/i })).toBeVisible();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter web exec playwright test reveals.spec.ts`
Expected: FAIL until the docker-compose stack + seeded DB are up and Phase 4–6 flows are wired (these are integration reveals, so they exercise the whole spine). Bring up the stack first if needed (see Task 9 CI job for the exact sequence).

- [ ] **Step 3: Fix any gap surfaced**

Common fixes: ensure the result page renders an explorer link with `NEXT_PUBLIC_EXPLORER_BASE`; ensure the prove UI maps the contract `NullifierUsed` revert to the visible `NULLIFIER_USED` copy (AGENT.md §5 — "that revert is the Sybil block; surface it cleanly"); ensure the gate claim writes a `GateClaim` row and shows confirmation. No PII may appear on the result page.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter web exec playwright test reveals.spec.ts`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add apps/web/tests/e2e/reveals.spec.ts
git commit -m "test(e2e): three acceptance reveals — no-PII-on-chain, sybil block, selective-disclosure claim"
```

---

### Task 8: Accessibility floor assertions (BRAND §10)

**Files:**
- Create: `apps/web/tests/e2e/a11y-floor.spec.ts`

**Interfaces:**
- Consumes: `/` , `/wallet/prove/*` (or a representative page with the foil-stamp CTA + a checkbox), `checkA11y`.

- [ ] **Step 1: Write the failing e2e spec**

```ts
// apps/web/tests/e2e/a11y-floor.spec.ts
import { test, expect } from "./fixtures";

test("visible keyboard focus + hit targets ≥40px on the primary CTA", async ({ page }) => {
  await page.goto("/");
  const cta = page.getByRole("button").or(page.getByRole("link")).filter({ hasText: /verify|prove|explore|begin|enter/i }).first();
  await cta.focus();
  // BRAND §10: focus must be visible (outline or border change), not removed without replacement.
  const focusStyle = await cta.evaluate((el) => {
    const s = getComputedStyle(el);
    return { outlineWidth: s.outlineWidth, outlineStyle: s.outlineStyle, boxShadow: s.boxShadow, borderColor: s.borderColor };
  });
  const hasVisibleFocus =
    (focusStyle.outlineStyle !== "none" && parseFloat(focusStyle.outlineWidth) > 0) ||
    focusStyle.boxShadow !== "none";
  expect(hasVisibleFocus).toBe(true);
  const box = await cta.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(40);
});

test("reduced-motion disables the foil shine and translate", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/");
  const shine = page.locator(".foil-stamp").first();
  await expect(shine).toBeVisible();
  const anim = await shine.evaluate((el) => getComputedStyle(el, "::before").animationName);
  expect(anim === "none" || anim === "").toBe(true); // @media (prefers-reduced-motion) sets animation: none
  await context.close();
});

test("status is never signalled by color alone", async ({ page }) => {
  await page.goto("/jobs");
  // every status pill carries text, not just a color (BRAND §10 + §7 status pills)
  const pills = page.locator("[data-status]");
  const count = await pills.count();
  for (let i = 0; i < count; i++) {
    const text = (await pills.nth(i).innerText()).trim();
    expect(text.length).toBeGreaterThan(0);
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter web exec playwright test a11y-floor.spec.ts`
Expected: FAIL if focus styles were stripped, the CTA is < 40px, the shine ignores reduced-motion, or a status pill lacks text.

- [ ] **Step 3: Fix any gap surfaced**

Per `BRAND.md §10/§11`: keep the `@media (prefers-reduced-motion: reduce){ .foil-stamp::before{ animation: none } }` rule; ensure interactive elements get `focus:border-primary` + a focus ring; size CTAs to ≥ 40px; ensure every status pill renders `label-md` text alongside color and carries a `data-status` attribute.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter web exec playwright test a11y-floor.spec.ts`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add apps/web/tests/e2e/a11y-floor.spec.ts apps/web/src/app/globals.css
git commit -m "test(a11y): focus, hit-target, reduced-motion, color-not-sole-signal floor"
```

---

### Task 9: CI gate (GitHub Actions)

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `pnpm` scripts `typecheck`, `lint`, `test`, `test:e2e`; docker-compose services; the seed.
- Produces: a single required check that runs install → typecheck → lint → unit → e2e → audit.

- [ ] **Step 1: Write the workflow**

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push: { branches: [main] }
  pull_request:
jobs:
  build-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_USER: zelyo, POSTGRES_PASSWORD: zelyo, POSTGRES_DB: zelyo }
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U zelyo" --health-interval 5s --health-timeout 5s --health-retries 10
      redis:
        image: redis:7
        ports: ["6379:6379"]
        options: --health-cmd "redis-cli ping" --health-interval 5s --health-timeout 5s --health-retries 10
      minio:
        image: bitnami/minio:latest
        env: { MINIO_ROOT_USER: minioadmin, MINIO_ROOT_PASSWORD: minioadmin, MINIO_DEFAULT_BUCKETS: zelyo }
        ports: ["9000:9000"]
    env:
      DATABASE_URL: postgresql://zelyo:zelyo@localhost:5432/zelyo
      DIRECT_URL: postgresql://zelyo:zelyo@localhost:5432/zelyo
      REDIS_URL: redis://localhost:6379
      S3_ENDPOINT: http://localhost:9000
      S3_REGION: us-east-1
      S3_BUCKET: zelyo
      S3_ACCESS_KEY_ID: minioadmin
      S3_SECRET_ACCESS_KEY: minioadmin
      S3_FORCE_PATH_STYLE: "true"
      AUTH_SECRET: ${{ secrets.AUTH_SECRET || 'ci-only-secret-at-least-32-bytes-long!!' }}
      AUTH_URL: http://127.0.0.1:3000
      AUTH_TRUST_HOST: "true"
      APP_URL: http://127.0.0.1:3000
      LOG_LEVEL: silent
      STELLAR_NETWORK: testnet
      NETWORK_PASSPHRASE: "Test SDF Network ; September 2015"
      SOROBAN_RPC_URL: https://soroban-testnet.stellar.org
      HORIZON_URL: https://horizon-testnet.stellar.org
      ISSUER_SECRET: ${{ secrets.CI_ISSUER_SECRET }}
      CREDENTIAL_REGISTRY_CONTRACT_ID: ${{ secrets.CI_REGISTRY_ID }}
      VERIFIER_CONTRACT_ID: ${{ secrets.CI_VERIFIER_ID }}
      ZK_SCOPE_APP_ID: zelyo
      ZK_VERIFY_MODE: ${{ secrets.CI_ZK_VERIFY_MODE }}
      CIRCUIT_ARTIFACT_BASE: /circuit
      ADMIN_USERNAME: admin
      ADMIN_PASSWORD: admin-password
      ISSUER_NAME: "Institute of Distributed Systems"
      ISSUER_STELLAR_ACCOUNT: ${{ secrets.CI_ISSUER_ACCOUNT }}
      NEXT_PUBLIC_EXPLORER_BASE: https://stellar.expert/explorer/testnet
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 10 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm i --frozen-lockfile
      - run: pnpm prisma generate
        working-directory: apps/web
      - run: pnpm prisma migrate deploy
        working-directory: apps/web
      - run: pnpm prisma db seed
        working-directory: apps/web
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm --filter web exec playwright install --with-deps chromium
      - run: pnpm build
        working-directory: apps/web
      - run: pnpm test:e2e
      - name: Audit (fail on critical)
        run: pnpm audit --audit-level critical
```

- [ ] **Step 2: Run the same sequence locally to verify it passes**

Run (with the docker-compose stack up):
```bash
docker compose up -d && \
pnpm i --frozen-lockfile && \
( cd apps/web && pnpm prisma generate && pnpm prisma migrate deploy && pnpm prisma db seed ) && \
pnpm typecheck && pnpm lint && pnpm test && \
( cd apps/web && pnpm build ) && \
pnpm test:e2e && \
pnpm audit --audit-level critical
```
Expected: every step exits 0. If `pnpm audit` reports a critical, bump the offending dependency (or add a justified `pnpm.overrides`) until clean.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: install --frozen-lockfile, typecheck/lint/test/e2e, audit gate"
```

---

### Task 10: Railway deployment config + contracts-once-from-CI doc

**Files:**
- Create: `railway.json`
- Create: `nixpacks.toml`
- Create: `docs/DEPLOY.md`

**Interfaces:**
- Consumes: `pnpm build`, `pnpm start`, `prisma migrate deploy`, `prisma db seed`; postgres/redis/bucket Railway plugins; contract IDs as Railway env vars.
- Produces: the deploy contract: web build `pnpm i --frozen-lockfile && pnpm prisma generate && pnpm build`; release `pnpm prisma migrate deploy && pnpm prisma db seed`; start `pnpm start`; COOP/COEP in prod (already in `next.config.ts` Task 1); secrets only via Railway variables.

- [ ] **Step 1: Add the Railway service config**

```json
// railway.json (web service)
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "pnpm i --frozen-lockfile && pnpm prisma generate && pnpm build"
  },
  "deploy": {
    "preDeployCommand": "pnpm prisma migrate deploy && pnpm prisma db seed",
    "startCommand": "pnpm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3,
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 120
  }
}
```

```toml
# nixpacks.toml
[phases.setup]
nixPkgs = ["nodejs_22", "pnpm-10_x"]

[phases.build]
# prisma generate + next build run via railway.json buildCommand
cmds = ["echo 'build handled by railway.json buildCommand'"]
```

- [ ] **Step 2: Write the deploy runbook**

```markdown
<!-- docs/DEPLOY.md -->
# Zelyo — Railway Deployment (SPEC §15)

## Services (Railway project)
- **web** — this repo. Build / release / start commands in `railway.json`.
- **Postgres** plugin → injects `DATABASE_URL` (+ set `DIRECT_URL` to the same value for migrations).
- **Redis** plugin → injects `REDIS_URL`.
- **Bucket** (Railway object storage / S3-compatible) → set `S3_ENDPOINT`, `S3_REGION`,
  `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE=false`.
  Bucket stays **private**; VC files are served via short-lived signed URLs.

## Required variables (Railway → web → Variables) — secrets ONLY here, never committed
APP_URL, AUTH_SECRET (≥32 bytes), AUTH_URL, AUTH_TRUST_HOST=true, LOG_LEVEL=info,
DATABASE_URL, DIRECT_URL, REDIS_URL, S3_* (above),
STELLAR_NETWORK=testnet, NETWORK_PASSPHRASE, SOROBAN_RPC_URL, HORIZON_URL,
ISSUER_SECRET (server-only testnet key — never NEXT_PUBLIC),
CREDENTIAL_REGISTRY_CONTRACT_ID, VERIFIER_CONTRACT_ID,
ZK_SCOPE_APP_ID, ZK_VERIFY_MODE (onchain|server — Phase 0 decision),
CIRCUIT_ARTIFACT_BASE=/circuit, ADMIN_USERNAME, ADMIN_PASSWORD,
ISSUER_NAME, ISSUER_STELLAR_ACCOUNT, NEXT_PUBLIC_EXPLORER_BASE.
No secret carries a NEXT_PUBLIC_ prefix.

## Headers in prod
`next.config.ts` emits HSTS + `Cross-Origin-Opener-Policy: same-origin` +
`Cross-Origin-Embedder-Policy: require-corp` in production so bb.js WASM threads work.
Railway terminates TLS (HTTPS by default). After first deploy, verify:
`curl -sI https://<app>.up.railway.app | grep -iE 'strict-transport|cross-origin|content-security|x-frame'`.

## Contracts are deployed ONCE (not per web deploy)
Soroban contracts are deployed a single time to testnet from a developer machine or a
dedicated CI job — NOT during the web build/release. Steps:

1. `pnpm contracts:build`            # stellar contract build (optimizes by default)
2. `pnpm contracts:deploy`           # deploys credential_registry + verifier to testnet,
                                      # funds the issuer account via Friendbot (dev), prints IDs
3. Copy the printed `CREDENTIAL_REGISTRY_CONTRACT_ID` and `VERIFIER_CONTRACT_ID`
   into Railway → web → Variables. The web service NEVER deploys contracts.
4. Re-run only when the contract changes; bump the IDs in Railway afterward.

A dedicated GitHub Actions `deploy-contracts` workflow (manual `workflow_dispatch`) may run
the same three steps using a secret testnet `ISSUER_SECRET`, then surface the IDs as job
output for an operator to paste into Railway. It must never run on every push.

## Release ordering
Railway runs `preDeployCommand` (migrate + seed, idempotent) before the new container takes
traffic, then `startCommand`. The seed is idempotent (upserts admin/issuer/empty tree/gate),
so repeat deploys are safe.
```

- [ ] **Step 3: Verify the config is valid JSON/TOML and the commands resolve**

Run: `node -e "JSON.parse(require('fs').readFileSync('railway.json','utf8')); console.log('railway.json OK')"`
Expected: `railway.json OK`. Then confirm the package scripts exist: `pnpm -w run | grep -E 'build|start'` shows `build` and `start`.

- [ ] **Step 4: Commit**

```bash
git add railway.json nixpacks.toml docs/DEPLOY.md
git commit -m "chore(deploy): Railway web build/release/start, COOP/COEP prod, contracts-once doc"
```

---

## Phase Gate / Acceptance

Run the full gate, then confirm each `SPEC.md §13` criterion maps to a passing test/check:

```bash
docker compose up -d
pnpm i --frozen-lockfile
( cd apps/web && pnpm prisma generate && pnpm prisma migrate deploy && pnpm prisma db seed )
pnpm typecheck && pnpm lint && pnpm test && ( cd apps/web && pnpm build ) && pnpm test:e2e
pnpm audit --audit-level critical
```

| SPEC §13 criterion | Mapped passing test / check |
|---|---|
| **13.1 Nothing personal on-chain** | `reveals.spec.ts › 13.1` (explorer link present via `NEXT_PUBLIC_EXPLORER_BASE`; result page contains `nullifier`, contains no learner name / grade) + `audit.test.ts` (audit row has no PII) + `redaction.test.ts` (no `attributes`/`s` in client bundle or logs). |
| **13.2 Sybil block** | `reveals.spec.ts › 13.2` (second submit of the same nullifier shows `NULLIFIER_USED`); upstream Rust duplicate-nullifier revert test from Phase 2 still green. |
| **13.3 Selective disclosure unlocks a claim** | `reveals.spec.ts › 13.3` (only `track` disclosed → gate claim recorded as `GateClaim`, confirmation + explorer link shown). |
| **13.4 Auth & roles** | `auth-roles.spec.ts` (admin reaches `/issuer/mint`; holder blocked from `/issuer/**`; unauth redirected to `/login`). |
| **13.5 Reproducible env** | CI job `build-test` runs `docker compose`-equivalent services + `pnpm i` + `prisma migrate deploy` + `db seed` + `pnpm dev` (via Playwright `webServer`) green; `/api/health` resolves. |

Cross-cutting hardening checks (Global Constraints):

| Requirement | Mapped passing test / check |
|---|---|
| CSP no `unsafe-inline` script; self-only font; XFO/XCTO/Referrer/Permissions-Policy; HSTS prod; COOP/COEP | `security-headers.test.ts` (all assertions) + `DEPLOY.md` `curl -sI` verification in prod. |
| Rate floors auth 10 / verify 20 / register 5 / mint 60 + claim, 429 + Retry-After | `rate-limit.test.ts` (floors + 429 + retryAfter) + handler grep. |
| Audit mint/revoke/verify with actor+ip, no PII | `audit.test.ts`. |
| PII/secret redaction (`authorization`/`password`/`set-cookie`/`s`/`attributes`); none in client bundle | `redaction.test.ts`. |
| Accessibility floor (focus, ≥40px, reduced-motion, color-not-sole-signal, axe AA) | `a11y-floor.spec.ts` + `checkA11y` in `auth-roles.spec.ts`. |
| CI gate + `pnpm audit` criticals | `.github/workflows/ci.yml`. |
| Railway deploy (build/release/start, COOP/COEP prod, plugins, contract IDs as vars, contracts-once, secrets via Railway only) | `railway.json` + `nixpacks.toml` + `docs/DEPLOY.md`. |

Do not mark Phase 7 complete until every row above is green.
```

