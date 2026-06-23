# Phase 3 — Web Foundation, Theme & Auth

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the `apps/web` Next.js 16 application — security-hardened config, the complete Tailwind v4 BRAND.md theme + signature components, the full Prisma data model with idempotent seed, Auth.js v5 Credentials auth with RBAC middleware, and the core server libraries (`db`, `redis`, `logger`, `stellar` with `publishRoot`, `storage`, `errors`/`AppError`, `ratelimit`, `env`) plus a readiness health check — so every later phase has a booting app, a typed env, a styled shell, and working login/register/RBAC.

**Architecture:** App Router app under `apps/web`. Server Components by default; the only Client Components in this phase are interactive brand components (FoilStampButton, TypewriterLog, Input, SidebarNav, StatusPill toggles) and the login/register forms (react-hook-form + Zod). Route handlers are thin (validate → authorize → service → typed response); business logic lives in `src/server/*` (added in later phases). All cross-cutting concerns are libraries in `src/lib/*` carrying `import "server-only"` where they touch secrets or Node APIs. The chain is the source of truth; `stellar.ts.publishRoot` signs with `ISSUER_SECRET` server-side only.

**Tech Stack:** Next.js 16.2 (App Router) · React 19.2 · TypeScript 6 (strict) · Tailwind v4.3 (CSS-first `@theme`) + `@tailwindcss/forms` · Prisma 7.8 + Postgres 16 · Auth.js v5 (`next-auth@5-beta`) · `@node-rs/argon2` · Zod 4 · react-hook-form 7 + `@hookform/resolvers` · `ioredis` 5 + `rate-limiter-flexible` 11 · `@aws-sdk/client-s3` 3 · `pino` 10 + `pino-http` 11 · `@stellar/stellar-sdk` 16 · Vitest 4 + React Testing Library.

## Global Constraints

These apply to **every task** below (copied from `2026-06-23-zelyo-00-index.md` Global Constraints — when SPEC and AGENT disagree on security the stricter wins):

- **Version floors (pin exact in lockfile; never downgrade; verify with `pnpm view <pkg> version`):** Node ≥ 22 LTS · pnpm 10.x · Next.js 16.2.x · React/React DOM 19.2.x · TypeScript 6.0.x · Tailwind 4.3.x + `@tailwindcss/postcss` + `@tailwindcss/forms` 0.5.x · Prisma + `@prisma/client` 7.8.x · Postgres 16 · Auth.js v5 (`next-auth@5` beta) + `@auth/prisma-adapter` · Zod 4.x · react-hook-form 7.x + `@hookform/resolvers` 5.x · `@node-rs/argon2` 2.x · `ioredis` 5.x + `rate-limiter-flexible` 11.x · `@aws-sdk/client-s3` 3.x / `minio` 8.x · `pino` 10.x + `pino-http` 11.x · `@stellar/stellar-sdk` 16.x · Vitest 4.x + Playwright 1.x · ESLint 10.x + Prettier 3.x.
- **TypeScript:** `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. No `any`; use `unknown` + Zod at boundaries.
- **Security:** no PII/secret on-chain, in logs, in analytics, or in client bundles. Holder secret `s` never stored or transmitted; server only sees `id_commitment = Poseidon(s)` and nullifiers. `ISSUER_SECRET`/signing keys server-only, never `NEXT_PUBLIC_`, never logged. Passwords argon2id; generic auth errors; constant-time delay + rate limit on login. Every external input Zod-validated and size-bounded; Prisma only. Thin route handlers → `src/server/*` services. Typed `AppError(code, httpStatus, publicMessage)` + one boundary mapping to `{ error: { code, message } }`; never leak stacks/DB errors. RBAC in middleware **and** every handler (`ADMIN` → `/issuer/**`,`/admin/**`; `HOLDER` → `/wallet/**`; never trust client role). Structured `pino` with redaction (`authorization`, `password`, `set-cookie`, `s`, attributes) + request id. Security headers in `next.config.ts`: CSP (no `unsafe-inline` scripts), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, minimal `Permissions-Policy`, **`Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`** (bb.js WASM threads). Rate limits (per IP): auth 10/min, `/api/verify` 20/min, register 5/min, mint 60/min → `429` + `Retry-After`. Private S3 bucket; signed URLs. Audit-log mint/revoke/verify to `AuditLog` (actor + ip, no PII).
- **Conventions:** Conventional Commits. Server-only modules carry `import "server-only";`. Parse `process.env` once through a typed Zod schema in `src/lib/env.ts`; fail fast on boot. New env vars go in `.env.example` **and** `env.ts`. Brand: one foil-stamp CTA per view; match `BRAND.md` tokens exactly; respect `prefers-reduced-motion`. Note Tailwind token override: `rounded-full` = 0.75rem (use explicit `border-radius: 9999px` for true circles).
- **Definition of done (every task):** builds; `pnpm --filter web typecheck` + `lint` + relevant tests pass; inputs Zod-validated; mutating routes RBAC-guarded + rate-limited; no secret/PII logged or shipped to client; new env vars in `.env.example` + `env.ts`; visibly matches `BRAND.md`.

**Prerequisites:** Phase 0 (workspace, `.env.example`, `env.ts` base, docker-compose with postgres/redis/minio), Phase 2 (`CREDENTIAL_REGISTRY_CONTRACT_ID` written to `.env` for `stellar.ts`).

**Gate:** see the **Phase Gate** checklist at the end — app boots, theme renders, `migrate` + `seed` succeed, login/register + RBAC redirect work, `/api/health` reports green.

---

## File Structure

Created/modified in this phase, under `apps/web/` unless noted:

- `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `vitest.setup.ts`, `eslint.config.mjs` — app config.
- `src/app/globals.css` — Tailwind v4 `@theme` (full BRAND token set) + signature utilities + self-hosted `@font-face`.
- `src/app/layout.tsx`, `src/app/page.tsx` — root layout + landing.
- `src/app/(auth)/login/page.tsx`, `src/app/(auth)/register/page.tsx` + their client forms.
- `src/components/*.tsx` + `src/components/__tests__/*.test.tsx` — signature components: `FoilStampButton`, `PrimaryButton`, `Input`, `TypewriterLog`, `LedgerPanel`, `SchematicFigure`, `RegistryCard`, `StatusPill`, `SidebarNav`, `RuleOrnament`.
- `src/lib/{env,db,redis,logger,stellar,storage,errors,ratelimit}.ts` — core libs.
- `src/middleware.ts` — RBAC.
- `auth.ts`, `auth.config.ts` — Auth.js v5.
- `src/app/api/auth/[...nextauth]/route.ts`, `src/app/api/holder/register/route.ts`, `src/app/api/health/route.ts` — route handlers.
- `prisma/schema.prisma`, `prisma/seed.ts` + migration.
- `src/lib/validation/auth.ts` — shared Zod schemas (client + server).

---

### Task 1: App scaffold, TS strict config, security headers (`next.config.ts`)

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.ts`, `apps/web/postcss.config.mjs`, `apps/web/eslint.config.mjs`, `apps/web/next-env.d.ts` (generated)
- Create: `apps/web/vitest.config.ts`, `apps/web/vitest.setup.ts`
- Create: `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx`
- Test: `apps/web/src/__tests__/headers.test.ts`

**Interfaces:**
- Produces: a booting Next 16 app; `next.config.ts` `headers()` returning the full security-header set (consumed implicitly by every route incl. the prover routes added in Phase 5).

- [ ] **Step 1: Add app `package.json`**

```json
{
  "name": "web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "prisma generate && next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:migrate": "prisma migrate dev",
    "db:seed": "prisma db seed"
  },
  "prisma": { "seed": "tsx prisma/seed.ts" },
  "dependencies": {
    "next": "16.2.0",
    "react": "19.2.0",
    "react-dom": "19.2.0",
    "next-auth": "5.0.0-beta.25",
    "@auth/prisma-adapter": "2.7.4",
    "@prisma/client": "7.8.0",
    "@node-rs/argon2": "2.0.2",
    "zod": "4.0.0",
    "react-hook-form": "7.54.0",
    "@hookform/resolvers": "5.0.0",
    "ioredis": "5.4.1",
    "rate-limiter-flexible": "11.0.0",
    "@aws-sdk/client-s3": "3.700.0",
    "@aws-sdk/s3-request-presigner": "3.700.0",
    "pino": "10.0.0",
    "pino-http": "11.0.0",
    "@stellar/stellar-sdk": "16.0.0",
    "server-only": "0.0.1"
  },
  "devDependencies": {
    "typescript": "6.0.0",
    "@types/node": "22.10.0",
    "@types/react": "19.2.0",
    "@types/react-dom": "19.2.0",
    "prisma": "7.8.0",
    "tsx": "4.19.2",
    "tailwindcss": "4.3.0",
    "@tailwindcss/postcss": "4.3.0",
    "@tailwindcss/forms": "0.5.10",
    "vitest": "4.0.0",
    "@vitejs/plugin-react": "5.0.0",
    "jsdom": "26.0.0",
    "@testing-library/react": "16.1.0",
    "@testing-library/jest-dom": "6.6.3",
    "@testing-library/user-event": "14.5.2",
    "eslint": "10.0.0",
    "eslint-config-next": "16.2.0"
  }
}
```

> Resolve each version to current latest at install with `pnpm view <pkg> version`; the numbers above are the floors — bump, never downgrade. Then `pnpm i` from the repo root.

- [ ] **Step 2: Add `tsconfig.json` (strict per Global Constraints)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noEmit": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "verbatimModuleSyntax": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Add `postcss.config.mjs` and `eslint.config.mjs`**

```js
// postcss.config.mjs
const config = { plugins: { "@tailwindcss/postcss": {} } };
export default config;
```

```js
// eslint.config.mjs
import next from "eslint-config-next";
export default [...next(), { rules: { "@typescript-eslint/no-explicit-any": "error" } }];
```

- [ ] **Step 4: Add `vitest.config.ts` + `vitest.setup.ts`**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
```

```ts
// vitest.setup.ts
import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
// server-only throws when imported outside RSC; stub it for unit tests.
vi.mock("server-only", () => ({}));
```

- [ ] **Step 5: Write the failing header test**

`apps/web/src/__tests__/headers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import nextConfig from "../../next.config";

describe("security headers", () => {
  it("declares COOP/COEP and the hardening headers globally", async () => {
    const groups = await nextConfig.headers!();
    const all = groups.find((g) => g.source === "/(.*)");
    expect(all).toBeDefined();
    const map = Object.fromEntries(all!.headers.map((h) => [h.key, h.value]));
    expect(map["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(map["Cross-Origin-Embedder-Policy"]).toBe("require-corp");
    expect(map["X-Frame-Options"]).toBe("DENY");
    expect(map["X-Content-Type-Options"]).toBe("nosniff");
    expect(map["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(map["Content-Security-Policy"]).toContain("default-src 'self'");
    expect(map["Content-Security-Policy"]).not.toContain("unsafe-inline 'self' 'unsafe-inline' script");
    expect(map["Permissions-Policy"]).toContain("camera=()");
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `pnpm --filter web test src/__tests__/headers.test.ts`
Expected: FAIL — cannot resolve `../../next.config` / `headers is not a function`.

- [ ] **Step 7: Write `next.config.ts` with the full header set**

```ts
import type { NextConfig } from "next";

// CSP: no unsafe-inline for scripts. 'wasm-unsafe-eval' is required for bb.js (UltraHonk WASM).
// 'unsafe-inline' is permitted for styles only (Tailwind/Next inject style tags).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://soroban-testnet.stellar.org https://horizon-testnet.stellar.org",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // bb.js WASM threads need cross-origin isolation; without these, proving silently fails.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["@node-rs/argon2", "pino", "@stellar/stellar-sdk"],
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
```

- [ ] **Step 8: Add minimal `layout.tsx` and `page.tsx` so the app boots**

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zelyo — Archival Registry for Cryptographic Truth",
  description: "ZK-backed verifiable credentials on Stellar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-body text-on-background antialiased">
        {children}
      </body>
    </html>
  );
}
```

```tsx
// src/app/page.tsx
export default function LandingPage() {
  return (
    <main className="mx-auto max-w-[1120px] px-margin-mobile py-stack-lg md:px-margin-page">
      <p className="font-label text-label-md uppercase text-secondary">The Zelyo Protocol</p>
      <h1 className="mt-stack-sm font-display text-display-lg text-primary">
        An archival journal for cryptographic truth
      </h1>
      <p className="mt-stack-md max-w-2xl font-body text-body-lg text-on-surface-variant">
        Credentials read like entries in a registry; proofs feel like sealed attestations.
      </p>
    </main>
  );
}
```

> `globals.css` is created in Task 2; classes like `bg-background` resolve once the `@theme` exists. The app boots regardless.

- [ ] **Step 9: Run the header test to verify it passes**

Run: `pnpm --filter web test src/__tests__/headers.test.ts`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/web/package.json apps/web/tsconfig.json apps/web/next.config.ts \
  apps/web/postcss.config.mjs apps/web/eslint.config.mjs apps/web/vitest.config.ts \
  apps/web/vitest.setup.ts apps/web/src/app/layout.tsx apps/web/src/app/page.tsx \
  apps/web/src/__tests__/headers.test.ts pnpm-lock.yaml
git commit -m "feat(web): scaffold Next 16 app with strict TS and security headers"
```

---

### Task 2: Tailwind v4 theme — full BRAND token set + signature utilities + self-hosted fonts

**Files:**
- Create: `apps/web/src/app/globals.css`
- Create: `apps/web/public/fonts/` (place self-hosted woff2 files; see Step 1)
- Test: `apps/web/src/__tests__/theme.test.ts`

**Interfaces:**
- Produces: the complete `@theme` token set (colors, fonts, type scale, spacing, radius) and the signature CSS utilities (`.foil-stamp`, `.ledger-line`, `.manuscript-glow`, `.typewriter`) consumed by every component and page.

- [ ] **Step 1: Self-host the four font families with `font-display: swap`**

Download woff2 for **EB Garamond** (400,500), **Source Serif 4** (400), **Hanken Grotesk** (600) from the Google Fonts CSS API (or `npx google-webfonts-helper`) into `apps/web/public/fonts/`. Courier is a system font — no file needed. Expected files:
`eb-garamond-500.woff2`, `eb-garamond-400.woff2`, `source-serif-4-400.woff2`, `hanken-grotesk-600.woff2`.

- [ ] **Step 2: Write the failing theme test**

`apps/web/src/__tests__/theme.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const css = readFileSync(
  fileURLToPath(new URL("../app/globals.css", import.meta.url)),
  "utf8",
);

describe("globals.css @theme", () => {
  it("imports tailwind + the forms plugin", () => {
    expect(css).toContain('@import "tailwindcss"');
    expect(css).toContain('@plugin "@tailwindcss/forms"');
  });

  it("defines the full BRAND.md §2 color set verbatim", () => {
    const expected: Record<string, string> = {
      "--color-background": "#fbf9f5",
      "--color-surface": "#fbf9f5",
      "--color-surface-bright": "#fbf9f5",
      "--color-on-background": "#1b1c1a",
      "--color-on-surface": "#1b1c1a",
      "--color-on-surface-variant": "#424846",
      "--color-primary": "#051a17",
      "--color-on-primary": "#ffffff",
      "--color-primary-container": "#1a2f2b",
      "--color-on-primary-container": "#809792",
      "--color-primary-fixed": "#d0e8e1",
      "--color-primary-fixed-dim": "#b4ccc5",
      "--color-inverse-primary": "#b4ccc5",
      "--color-secondary": "#635e56",
      "--color-secondary-container": "#eae1d7",
      "--color-secondary-fixed-dim": "#cdc5bc",
      "--color-tertiary": "#25120b",
      "--color-tertiary-container": "#3c261e",
      "--color-tertiary-fixed": "#ffdbcf",
      "--color-surface-container-lowest": "#ffffff",
      "--color-surface-container-low": "#f5f3ef",
      "--color-surface-container": "#efeeea",
      "--color-surface-container-high": "#eae8e4",
      "--color-surface-container-highest": "#e4e2de",
      "--color-surface-variant": "#e4e2de",
      "--color-surface-dim": "#dbdad6",
      "--color-outline": "#727876",
      "--color-outline-variant": "#c2c8c5",
      "--color-error": "#ba1a1a",
      "--color-error-container": "#ffdad6",
      "--color-inverse-surface": "#30312e",
      "--color-inverse-on-surface": "#f2f0ed",
    };
    for (const [k, v] of Object.entries(expected)) {
      expect(css, `${k}`).toContain(`${k}: ${v};`);
    }
  });

  it("defines fonts, type scale, spacing, and the radius-full override", () => {
    expect(css).toContain('--font-display: "EB Garamond"');
    expect(css).toContain('--font-body: "Source Serif 4"');
    expect(css).toContain('--font-label: "Hanken Grotesk"');
    expect(css).toContain("--text-display-lg: 48px;");
    expect(css).toContain("--text-display-lg--letter-spacing: -0.02em;");
    expect(css).toContain("--spacing-margin-page: 64px;");
    expect(css).toContain("--radius-full: 0.75rem;");
  });

  it("defines the signature utilities + reduced-motion guard", () => {
    expect(css).toContain(".foil-stamp");
    expect(css).toContain("@keyframes shine");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain(".ledger-line");
    expect(css).toContain(".manuscript-glow");
    expect(css).toContain(".typewriter");
  });

  it("self-hosts fonts with font-display: swap", () => {
    expect(css).toContain("@font-face");
    expect(css).toContain("font-display: swap;");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter web test src/__tests__/theme.test.ts`
Expected: FAIL — `globals.css` does not exist / tokens missing.

- [ ] **Step 4: Write `src/app/globals.css` — the complete theme**

```css
@import "tailwindcss";
@plugin "@tailwindcss/forms";

/* ── Self-hosted fonts (BRAND.md §3 / §10: font-display: swap) ───────────── */
@font-face {
  font-family: "EB Garamond";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("/fonts/eb-garamond-400.woff2") format("woff2");
}
@font-face {
  font-family: "EB Garamond";
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url("/fonts/eb-garamond-500.woff2") format("woff2");
}
@font-face {
  font-family: "Source Serif 4";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("/fonts/source-serif-4-400.woff2") format("woff2");
}
@font-face {
  font-family: "Hanken Grotesk";
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url("/fonts/hanken-grotesk-600.woff2") format("woff2");
}

@theme {
  /* ── Color (BRAND.md §2 — full set, exact hex) ──────────────────────── */
  --color-background: #fbf9f5;
  --color-surface: #fbf9f5;
  --color-surface-bright: #fbf9f5;
  --color-on-background: #1b1c1a;
  --color-on-surface: #1b1c1a;
  --color-on-surface-variant: #424846;
  --color-primary: #051a17;
  --color-on-primary: #ffffff;
  --color-primary-container: #1a2f2b;
  --color-on-primary-container: #809792;
  --color-primary-fixed: #d0e8e1;
  --color-primary-fixed-dim: #b4ccc5;
  --color-inverse-primary: #b4ccc5;
  --color-secondary: #635e56;
  --color-secondary-container: #eae1d7;
  --color-secondary-fixed-dim: #cdc5bc;
  --color-tertiary: #25120b;
  --color-tertiary-container: #3c261e;
  --color-tertiary-fixed: #ffdbcf;
  --color-surface-container-lowest: #ffffff;
  --color-surface-container-low: #f5f3ef;
  --color-surface-container: #efeeea;
  --color-surface-container-high: #eae8e4;
  --color-surface-container-highest: #e4e2de;
  --color-surface-variant: #e4e2de;
  --color-surface-dim: #dbdad6;
  --color-outline: #727876;
  --color-outline-variant: #c2c8c5;
  --color-error: #ba1a1a;
  --color-error-container: #ffdad6;
  --color-inverse-surface: #30312e;
  --color-inverse-on-surface: #f2f0ed;

  /* ── Fonts (BRAND.md §3) ────────────────────────────────────────────── */
  --font-display: "EB Garamond", serif;
  --font-headline: "EB Garamond", serif;
  --font-body: "Source Serif 4", serif;
  --font-label: "Hanken Grotesk", sans-serif;
  --font-mono: "Courier New", ui-monospace, monospace;

  /* ── Type scale (BRAND.md §3 — exact) ───────────────────────────────── */
  --text-display-lg: 48px;
  --text-display-lg--line-height: 56px;
  --text-display-lg--letter-spacing: -0.02em;
  --text-display-lg--font-weight: 500;
  --text-display-lg-mobile: 36px;
  --text-display-lg-mobile--line-height: 42px;
  --text-display-lg-mobile--letter-spacing: -0.01em;
  --text-display-lg-mobile--font-weight: 500;
  --text-headline-md: 32px;
  --text-headline-md--line-height: 40px;
  --text-headline-md--font-weight: 500;
  --text-body-lg: 20px;
  --text-body-lg--line-height: 32px;
  --text-body-lg--font-weight: 400;
  --text-body-md: 17px;
  --text-body-md--line-height: 28px;
  --text-body-md--font-weight: 400;
  --text-label-md: 14px;
  --text-label-md--line-height: 20px;
  --text-label-md--letter-spacing: 0.05em;
  --text-label-md--font-weight: 600;
  --text-caption: 12px;
  --text-caption--line-height: 16px;
  --text-caption--font-weight: 400;

  /* ── Spacing (BRAND.md §4 — named, exact) ───────────────────────────── */
  --spacing-unit: 4px;
  --spacing-stack-sm: 8px;
  --spacing-stack-md: 24px;
  --spacing-stack-lg: 48px;
  --spacing-gutter: 32px;
  --spacing-margin-page: 64px;
  --spacing-margin-mobile: 20px;

  /* ── Radius (BRAND.md §4 — note: full = 0.75rem, NOT a pill) ─────────── */
  --radius: 0.125rem;
  --radius-lg: 0.25rem;
  --radius-xl: 0.5rem;
  --radius-full: 0.75rem;
}

/* ── Signature utilities (BRAND.md §6 / §11) ──────────────────────────── */
.manuscript-glow {
  box-shadow: 0 0 40px rgba(99, 94, 86, 0.05);
}
.ledger-line {
  background-image: linear-gradient(to bottom, transparent 31px, #e4e2de 31px);
  background-size: 100% 32px;
}
.typewriter {
  font-family: var(--font-mono);
  letter-spacing: -0.5px;
}
.foil-stamp {
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #051a17 0%, #1a2f2b 100%);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
}
.foil-stamp::before {
  content: "";
  position: absolute;
  inset: -50%;
  width: 200%;
  height: 200%;
  background: linear-gradient(
    45deg,
    transparent 45%,
    rgba(180, 204, 197, 0.1) 50%,
    transparent 55%
  );
  animation: shine 6s infinite linear;
}
@keyframes shine {
  0% {
    transform: translate(-100%, -100%);
  }
  100% {
    transform: translate(100%, 100%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .foil-stamp::before {
    animation: none;
  }
}
```

- [ ] **Step 5: Run the theme test to verify it passes**

Run: `pnpm --filter web test src/__tests__/theme.test.ts`
Expected: PASS (all assertions).

- [ ] **Step 6: Smoke-check the build picks up the theme**

Run: `pnpm --filter web build`
Expected: build succeeds; `bg-background`, `font-display`, `text-display-lg` from `page.tsx` compile without "unknown utility" errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/public/fonts apps/web/src/__tests__/theme.test.ts
git commit -m "feat(web): Tailwind v4 BRAND theme, signature utilities, self-hosted fonts"
```

---

### Task 3: Signature components (BRAND.md §6/§7) with RTL render tests

**Files:**
- Create: `apps/web/src/components/{FoilStampButton,PrimaryButton,Input,TypewriterLog,LedgerPanel,SchematicFigure,RegistryCard,StatusPill,SidebarNav,RuleOrnament}.tsx`
- Test: `apps/web/src/components/__tests__/{FoilStampButton,PrimaryButton,Input,TypewriterLog,LedgerPanel,SchematicFigure,RegistryCard,StatusPill,SidebarNav,RuleOrnament}.test.tsx`

**Interfaces:**
- Produces: reusable brand components consumed by every page in Phases 3–6. Key exported signatures:
  - `FoilStampButton(props: ButtonHTMLAttributes & { children })` — `"use client"`, one per view.
  - `PrimaryButton(props: ButtonHTMLAttributes & { children })`.
  - `Input(props: { label: string; name: string } & InputHTMLAttributes)` — bottom-rule, `"use client"`.
  - `TypewriterLog(props: { lines: LogLine[] })`, `type LogLine = { time: string; event: string; status: string }` — `"use client"`.
  - `LedgerPanel(props: { children })`, `SchematicFigure(props: { caption: string; nodes: string[] })`, `RegistryCard(props: { label: string; title: string; meta?: string; children?; spine?: boolean })`, `StatusPill(props: { label: string; tone?: "default" | "error" })`, `SidebarNav(props: { items: NavItem[] })` with `type NavItem = { href: string; label: string; icon?: string }` — `"use client"`, `RuleOrnament()`.

- [ ] **Step 1: Write failing tests for all ten components**

`apps/web/src/components/__tests__/FoilStampButton.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FoilStampButton } from "../FoilStampButton";

describe("FoilStampButton", () => {
  it("renders an uppercase label with the foil-stamp brand class", () => {
    render(<FoilStampButton>Seal &amp; Authorize</FoilStampButton>);
    const btn = screen.getByRole("button", { name: /seal & authorize/i });
    expect(btn).toHaveClass("foil-stamp");
    expect(btn.className).toContain("uppercase");
    expect(btn.className).toContain("text-on-primary");
  });
});
```

`apps/web/src/components/__tests__/PrimaryButton.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PrimaryButton } from "../PrimaryButton";

describe("PrimaryButton", () => {
  it("renders a solid primary button", () => {
    render(<PrimaryButton>Continue</PrimaryButton>);
    const btn = screen.getByRole("button", { name: "Continue" });
    expect(btn.className).toContain("bg-primary");
    expect(btn.className).toContain("text-background");
    expect(btn.className).toContain("uppercase");
  });
});
```

`apps/web/src/components/__tests__/Input.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Input } from "../Input";

describe("Input", () => {
  it("renders a bottom-rule input with an associated uppercase label", () => {
    render(<Input label="Username" name="username" />);
    const input = screen.getByLabelText("Username");
    expect(input).toHaveAttribute("name", "username");
    expect(input.className).toContain("border-b");
    expect(input.className).toContain("border-outline");
    const label = screen.getByText("Username");
    expect(label.className).toContain("uppercase");
  });
});
```

`apps/web/src/components/__tests__/TypewriterLog.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TypewriterLog } from "../TypewriterLog";

describe("TypewriterLog", () => {
  it("renders timestamped lines in a monospace log region", () => {
    render(
      <TypewriterLog
        lines={[{ time: "12:00:01", event: "LEAF INSERTED", status: "OK" }]}
      />,
    );
    const log = screen.getByRole("log");
    expect(log.className).toContain("typewriter");
    expect(screen.getByText(/12:00:01/)).toBeInTheDocument();
    expect(screen.getByText(/LEAF INSERTED/)).toBeInTheDocument();
    expect(screen.getByText(/OK/)).toBeInTheDocument();
  });
});
```

`apps/web/src/components/__tests__/LedgerPanel.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LedgerPanel } from "../LedgerPanel";

describe("LedgerPanel", () => {
  it("wraps children in a ledger-line background", () => {
    render(<LedgerPanel>content</LedgerPanel>);
    const panel = screen.getByText("content").closest("div");
    expect(panel?.className).toContain("ledger-line");
  });
});
```

`apps/web/src/components/__tests__/SchematicFigure.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SchematicFigure } from "../SchematicFigure";

describe("SchematicFigure", () => {
  it("renders a captioned figure with line-art nodes", () => {
    render(<SchematicFigure caption="Fig 1.1" nodes={["DATA", "HASH", "ROOT"]} />);
    const fig = screen.getByRole("figure");
    expect(fig).toBeInTheDocument();
    expect(screen.getByText("Fig 1.1").className).toContain("uppercase");
    expect(screen.getByText("DATA")).toBeInTheDocument();
    expect(screen.getByText("ROOT")).toBeInTheDocument();
  });
});
```

`apps/web/src/components/__tests__/RegistryCard.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RegistryCard } from "../RegistryCard";

describe("RegistryCard", () => {
  it("renders a ledger-entry label, title, and an evergreen spine when asked", () => {
    render(
      <RegistryCard label="Registry Entry No. 4,102" title="Data Engineering" spine>
        body
      </RegistryCard>,
    );
    expect(screen.getByText("Registry Entry No. 4,102").className).toContain("uppercase");
    expect(screen.getByText("Data Engineering")).toBeInTheDocument();
    const card = screen.getByText("Data Engineering").closest("article");
    expect(card?.className).toContain("border-l-2");
    expect(card?.className).toContain("border-primary");
  });
});
```

`apps/web/src/components/__tests__/StatusPill.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusPill } from "../StatusPill";

describe("StatusPill", () => {
  it("renders an uppercase status label and an error tone", () => {
    render(<StatusPill label="Status: Authenticated" />);
    const ok = screen.getByText("Status: Authenticated");
    expect(ok.className).toContain("uppercase");

    render(<StatusPill label="Nullifier Used" tone="error" />);
    expect(screen.getByText("Nullifier Used").className).toContain("text-error");
  });
});
```

`apps/web/src/components/__tests__/SidebarNav.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SidebarNav } from "../SidebarNav";

vi.mock("next/navigation", () => ({ usePathname: () => "/issuer/mint" }));

describe("SidebarNav", () => {
  it("renders nav items and marks the active route with the brand active styles", () => {
    render(
      <SidebarNav
        items={[
          { href: "/issuer", label: "Dashboard" },
          { href: "/issuer/mint", label: "Mint" },
        ]}
      />,
    );
    const active = screen.getByRole("link", { name: "Mint" });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(active.className).toContain("border-l-2");
    expect(active.className).toContain("border-primary");
    expect(active.className).toContain("bg-secondary-container");
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
```

`apps/web/src/components/__tests__/RuleOrnament.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RuleOrnament } from "../RuleOrnament";

describe("RuleOrnament", () => {
  it("renders a separator with a centered lozenge", () => {
    render(<RuleOrnament />);
    const sep = screen.getByRole("separator");
    expect(sep).toBeInTheDocument();
    expect(sep.textContent).toContain("◆");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web test src/components`
Expected: FAIL — components do not exist (module-not-found for each).

- [ ] **Step 3: Implement the components**

`apps/web/src/components/FoilStampButton.tsx`:

```tsx
"use client";
import type { ButtonHTMLAttributes } from "react";

export function FoilStampButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`foil-stamp inline-flex items-center justify-center rounded px-stack-md py-3 font-label text-label-md uppercase tracking-[0.05em] text-on-primary transition-transform duration-200 hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-fixed disabled:opacity-60 ${className}`}
    >
      <span className="relative z-10">{children}</span>
    </button>
  );
}
```

`apps/web/src/components/PrimaryButton.tsx`:

```tsx
import type { ButtonHTMLAttributes } from "react";

export function PrimaryButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded bg-primary px-stack-md py-3 font-label text-label-md uppercase tracking-[0.05em] text-background transition-colors duration-200 hover:bg-primary-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}
```

`apps/web/src/components/Input.tsx`:

```tsx
"use client";
import { useId, type InputHTMLAttributes } from "react";

type InputProps = { label: string; name: string } & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "name"
>;

export function Input({ label, name, className = "", ...props }: InputProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-stack-sm">
      <label
        htmlFor={id}
        className="font-label text-label-md uppercase tracking-[0.05em] text-secondary peer-focus:text-primary"
      >
        {label}
      </label>
      <input
        id={id}
        name={name}
        className={`peer w-full border-0 border-b border-outline bg-transparent px-0 py-2 font-body text-body-lg text-on-surface focus:border-primary focus:outline-none focus:ring-0 ${className}`}
        {...props}
      />
    </div>
  );
}
```

`apps/web/src/components/TypewriterLog.tsx`:

```tsx
"use client";

export type LogLine = { time: string; event: string; status: string };

export function TypewriterLog({ lines }: { lines: LogLine[] }) {
  return (
    <div
      role="log"
      aria-live="polite"
      className="typewriter rounded bg-surface-container-high p-stack-md text-body-md text-on-surface"
    >
      {lines.map((l, i) => (
        <div
          key={i}
          className="border-b border-outline-variant/40 py-1 last:border-b-0"
        >
          <span className="text-secondary">[{l.time}]</span> {l.event} …{" "}
          <span className="text-primary">{l.status}</span>
        </div>
      ))}
      <span className="inline-block w-2 animate-pulse text-primary motion-reduce:animate-none">
        ▍
      </span>
    </div>
  );
}
```

`apps/web/src/components/LedgerPanel.tsx`:

```tsx
export function LedgerPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="ledger-line rounded border border-outline-variant p-stack-md">
      {children}
    </div>
  );
}
```

`apps/web/src/components/SchematicFigure.tsx`:

```tsx
export function SchematicFigure({
  caption,
  nodes,
}: {
  caption: string;
  nodes: string[];
}) {
  return (
    <figure className="rounded border border-outline-variant p-stack-md">
      <div className="flex flex-wrap items-center gap-stack-sm">
        {nodes.map((node, i) => (
          <span key={node} className="flex items-center gap-stack-sm">
            <span className="rounded border border-outline px-stack-sm py-2 font-label text-label-md uppercase tracking-[0.05em] text-on-surface">
              {node}
            </span>
            {i < nodes.length - 1 && (
              <span aria-hidden className="text-secondary">
                →
              </span>
            )}
          </span>
        ))}
      </div>
      <figcaption className="mt-stack-sm font-label text-caption uppercase tracking-[0.05em] text-secondary">
        {caption}
      </figcaption>
    </figure>
  );
}
```

`apps/web/src/components/RegistryCard.tsx`:

```tsx
export function RegistryCard({
  label,
  title,
  meta,
  spine = false,
  children,
}: {
  label: string;
  title: string;
  meta?: string;
  spine?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <article
      className={`manuscript-glow rounded border border-outline-variant bg-surface-container-lowest p-stack-md ${
        spine ? "border-l-2 border-l-primary" : ""
      }`}
    >
      <p className="font-label text-caption uppercase tracking-[0.05em] text-secondary">
        {label}
      </p>
      <h3 className="mt-stack-sm font-headline text-headline-md text-primary">
        {title}
      </h3>
      {meta && <p className="mt-1 font-body text-body-md text-on-surface-variant">{meta}</p>}
      {children && <div className="mt-stack-md">{children}</div>}
    </article>
  );
}
```

`apps/web/src/components/StatusPill.tsx`:

```tsx
export function StatusPill({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "error";
}) {
  const toneClass =
    tone === "error"
      ? "border-error text-error"
      : "border-outline-variant text-on-surface-variant";
  return (
    <span
      className={`inline-flex items-center rounded border px-stack-sm py-1 font-label text-label-md uppercase tracking-[0.05em] ${toneClass}`}
    >
      {label}
    </span>
  );
}
```

`apps/web/src/components/SidebarNav.tsx`:

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; icon?: string };

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex w-64 flex-col gap-1 bg-surface-container-low p-stack-md">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`border-l-2 px-stack-md py-2 font-label text-label-md uppercase tracking-[0.05em] transition-colors hover:bg-surface-container ${
              active
                ? "border-primary bg-secondary-container text-primary"
                : "border-transparent text-on-surface-variant"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

`apps/web/src/components/RuleOrnament.tsx`:

```tsx
export function RuleOrnament() {
  return (
    <div role="separator" className="my-stack-md flex items-center gap-stack-sm">
      <span className="h-px flex-1 bg-outline-variant" />
      <span aria-hidden className="text-secondary">
        ◆
      </span>
      <span className="h-px flex-1 bg-outline-variant" />
    </div>
  );
}
```

- [ ] **Step 4: Run the component tests to verify they pass**

Run: `pnpm --filter web test src/components`
Expected: PASS (10 files).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components
git commit -m "feat(web): signature BRAND components with render tests"
```

---

### Task 4: `env.ts` (typed, fail-fast) + `.env.example` extension

**Files:**
- Create: `apps/web/src/lib/env.ts`
- Modify: `.env.example` (repo root — ensure all Phase 0/3 keys present)
- Test: `apps/web/src/lib/__tests__/env.test.ts`

**Interfaces:**
- Produces: `export const env` — a validated, typed object. Consumed by `db.ts`, `redis.ts`, `logger.ts`, `stellar.ts`, `storage.ts`, `ratelimit.ts`, `auth.config.ts`, `seed.ts`.

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/__tests__/env.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";

const GOOD = {
  NODE_ENV: "test",
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
  ISSUER_SECRET: "S".repeat(56),
  CREDENTIAL_REGISTRY_CONTRACT_ID: "C".repeat(56),
  ZK_SCOPE_APP_ID: "zelyo-v1",
  ZK_VERIFY_MODE: "server",
  CIRCUIT_ARTIFACT_BASE: "/circuit",
  ADMIN_USERNAME: "admin",
  ADMIN_PASSWORD: "a-strong-password",
  ISSUER_NAME: "Institute of Distributed Systems",
  ISSUER_STELLAR_ACCOUNT: "G".repeat(56),
};

describe("env", () => {
  beforeEach(() => {
    for (const [k, v] of Object.entries(GOOD)) process.env[k] = v;
  });
  afterEach(() => {
    for (const k of Object.keys(GOOD)) delete process.env[k];
    vi.resetModules();
  });

  it("parses a valid environment", async () => {
    const { env } = await import("../env");
    expect(env.S3_FORCE_PATH_STYLE).toBe(true);
    expect(env.ZK_VERIFY_MODE).toBe("server");
    expect(env.AUTH_SECRET.length).toBeGreaterThanOrEqual(32);
  });

  it("throws fast when AUTH_SECRET is too short", async () => {
    process.env.AUTH_SECRET = "short";
    vi.resetModules();
    await expect(import("../env")).rejects.toThrow(/AUTH_SECRET/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter web test src/lib/__tests__/env.test.ts`
Expected: FAIL — `../env` not found.

- [ ] **Step 3: Implement `env.ts`**

```ts
import { z } from "zod";

const boolish = z
  .enum(["true", "false"])
  .transform((v) => v === "true");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url(),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be ≥ 32 bytes"),
  AUTH_URL: z.url(),
  AUTH_TRUST_HOST: boolish.default(true),

  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),

  REDIS_URL: z.string().min(1),

  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: boolish.default(true),

  STELLAR_NETWORK: z.string().min(1),
  NETWORK_PASSPHRASE: z.string().min(1),
  SOROBAN_RPC_URL: z.url(),
  HORIZON_URL: z.url(),
  ISSUER_SECRET: z.string().min(1),
  CREDENTIAL_REGISTRY_CONTRACT_ID: z.string().min(1),
  VERIFIER_CONTRACT_ID: z.string().optional(),

  ZK_SCOPE_APP_ID: z.string().min(1),
  ZK_VERIFY_MODE: z.enum(["onchain", "server"]).default("server"),
  CIRCUIT_ARTIFACT_BASE: z.string().min(1).default("/circuit"),

  ADMIN_USERNAME: z.string().min(1),
  ADMIN_PASSWORD: z.string().min(8),
  ISSUER_NAME: z.string().min(1),
  ISSUER_STELLAR_ACCOUNT: z.string().min(1),

  NEXT_PUBLIC_EXPLORER_BASE: z.url().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Do not print values — only which keys failed (avoid leaking secrets).
  const issues = parsed.error.issues
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const env = parsed.data;
export type Env = typeof env;
```

- [ ] **Step 4: Ensure `.env.example` has the full key set**

Confirm `.env.example` (created in Phase 0) contains every key from the env schema. Add any missing: `ZK_VERIFY_MODE=server`, `NEXT_PUBLIC_EXPLORER_BASE=https://stellar.expert/explorer/testnet`. (`VERIFIER_CONTRACT_ID` may be blank.) No secret carries `NEXT_PUBLIC_`.

- [ ] **Step 5: Run the env test to verify it passes**

Run: `pnpm --filter web test src/lib/__tests__/env.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/env.ts apps/web/src/lib/__tests__/env.test.ts .env.example
git commit -m "feat(web): typed fail-fast env schema with full key set"
```

---

### Task 5: `errors.ts` (`AppError` + boundary), `logger.ts` (pino + redaction)

**Files:**
- Create: `apps/web/src/lib/errors.ts`, `apps/web/src/lib/logger.ts`
- Test: `apps/web/src/lib/__tests__/errors.test.ts`, `apps/web/src/lib/__tests__/logger.test.ts`

**Interfaces:**
- Produces:
  - `class AppError extends Error { constructor(code: string, httpStatus: number, publicMessage: string) }` with `code`, `httpStatus`, `publicMessage`.
  - `toErrorResponse(err: unknown): { status: number; body: { error: { code: string; message: string } } }` — the single boundary mapping; unknown errors → 500 `INTERNAL` "Something went wrong" (no stack leak).
  - `logger` — a redacting `pino` instance. Consumed by every service/handler.

- [ ] **Step 1: Write failing tests**

`apps/web/src/lib/__tests__/errors.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { AppError, toErrorResponse } from "../errors";

describe("AppError boundary", () => {
  it("maps an AppError to its public shape", () => {
    const r = toErrorResponse(new AppError("UNAUTHORIZED", 401, "Sign in required"));
    expect(r.status).toBe(401);
    expect(r.body).toEqual({ error: { code: "UNAUTHORIZED", message: "Sign in required" } });
  });

  it("never leaks unknown errors", () => {
    const r = toErrorResponse(new Error("connect ECONNREFUSED 5432 password=hunter2"));
    expect(r.status).toBe(500);
    expect(r.body.error.code).toBe("INTERNAL");
    expect(JSON.stringify(r.body)).not.toContain("hunter2");
  });
});
```

`apps/web/src/lib/__tests__/logger.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { logger } from "../logger";

describe("logger", () => {
  it("redacts secrets and PII paths", () => {
    // pino exposes the configured redact paths on the symbol-free options.
    const paths = (logger as unknown as { redact?: { paths?: string[] } }).redact?.paths ?? [];
    for (const p of ["password", "s", "authorization", "set-cookie", "attributes"]) {
      expect(paths.join(",")).toContain(p);
    }
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter web test src/lib/__tests__/errors.test.ts src/lib/__tests__/logger.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `errors.ts`**

```ts
export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly httpStatus: number,
    public readonly publicMessage: string,
  ) {
    super(publicMessage);
    this.name = "AppError";
  }
}

export type ErrorBody = { error: { code: string; message: string } };

export function toErrorResponse(err: unknown): { status: number; body: ErrorBody } {
  if (err instanceof AppError) {
    return { status: err.httpStatus, body: { error: { code: err.code, message: err.publicMessage } } };
  }
  // Unknown errors: never leak the message/stack/DB detail.
  return { status: 500, body: { error: { code: "INTERNAL", message: "Something went wrong" } } };
}
```

- [ ] **Step 4: Implement `logger.ts`**

```ts
import "server-only";
import { pino } from "pino";
import { env } from "./env";

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      "password",
      "*.password",
      "s",
      "*.s",
      "attributes",
      "*.attributes",
      "req.headers.authorization",
      "headers.authorization",
      "authorization",
      "req.headers.cookie",
      'res.headers["set-cookie"]',
      "set-cookie",
    ],
    censor: "[REDACTED]",
  },
  base: { app: "zelyo-web" },
});
```

> The logger test imports `logger`; because `vitest.setup.ts` stubs `server-only`, the `import "server-only"` is a no-op in tests.

- [ ] **Step 5: Run to verify they pass**

Run: `pnpm --filter web test src/lib/__tests__/errors.test.ts src/lib/__tests__/logger.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/errors.ts apps/web/src/lib/logger.ts apps/web/src/lib/__tests__/errors.test.ts apps/web/src/lib/__tests__/logger.test.ts
git commit -m "feat(web): AppError boundary and redacting pino logger"
```

---

### Task 6: Prisma schema (exact SPEC §9 models) + migration

**Files:**
- Create: `apps/web/prisma/schema.prisma`
- Create: `apps/web/prisma/migrations/**` (generated)
- Test: `apps/web/src/lib/__tests__/schema.test.ts`

**Interfaces:**
- Produces: the full data model (`User`, `Issuer`, `HolderKey`, `MerkleTree`, `Leaf`, `RootHistory`, `Credential`, `Nullifier`, `Verification`, `JobGate`, `GateClaim`, `AuditLog` + enums `Role`, `CredentialStatus`, `VerificationResult`). `VerificationResult` mirrors the `VerifyResult.result` contract type. Consumed by `db.ts`, `seed.ts`, and every later service.

- [ ] **Step 1: Write a failing schema-shape test**

`apps/web/src/lib/__tests__/schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const schema = readFileSync(
  fileURLToPath(new URL("../../../prisma/schema.prisma", import.meta.url)),
  "utf8",
);

describe("prisma schema", () => {
  it("uses postgres with directUrl for migrations", () => {
    expect(schema).toContain('provider = "postgresql"');
    expect(schema).toContain("directUrl = env(\"DIRECT_URL\")");
  });
  it("declares all SPEC §9 enums and models", () => {
    for (const e of ["enum Role", "enum CredentialStatus", "enum VerificationResult"]) {
      expect(schema, e).toContain(e);
    }
    for (const m of [
      "model User",
      "model Issuer",
      "model HolderKey",
      "model MerkleTree",
      "model Leaf",
      "model RootHistory",
      "model Credential",
      "model Nullifier",
      "model Verification",
      "model JobGate",
      "model GateClaim",
      "model AuditLog",
    ]) {
      expect(schema, m).toContain(m);
    }
  });
  it("mirrors the VerificationResult contract variants", () => {
    expect(schema).toContain("VERIFIED");
    expect(schema).toContain("NULLIFIER_USED");
    expect(schema).toContain("UNKNOWN_ROOT");
    expect(schema).toContain("INVALID_PROOF");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter web test src/lib/__tests__/schema.test.ts`
Expected: FAIL — `schema.prisma` missing.

- [ ] **Step 3: Write `prisma/schema.prisma` (copied verbatim from SPEC §9)**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

enum Role {
  ADMIN
  HOLDER
}

enum CredentialStatus {
  ACTIVE
  REVOKED
}

enum VerificationResult {
  VERIFIED
  INVALID_PROOF
  UNKNOWN_ROOT
  NULLIFIER_USED
  ERROR
}

model User {
  id           String     @id @default(cuid())
  username     String     @unique
  passwordHash String
  role         Role       @default(HOLDER)
  holderKey    HolderKey?
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
}

model Issuer {
  id             String       @id @default(cuid())
  name           String
  stellarAccount String
  createdAt      DateTime     @default(now())
  credentials    Credential[]
}

model HolderKey {
  id           String       @id @default(cuid())
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId       String       @unique
  idCommitment String       @unique
  createdAt    DateTime     @default(now())
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
  id         String      @id @default(cuid())
  tree       MerkleTree  @relation(fields: [treeId], references: [id])
  treeId     String
  index      Int
  leafHex    String
  credential Credential?
  createdAt  DateTime    @default(now())

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
  id            String           @id @default(cuid())
  issuer        Issuer           @relation(fields: [issuerId], references: [id])
  issuerId      String
  holderKey     HolderKey        @relation(fields: [holderKeyId], references: [id])
  holderKeyId   String
  attributes    Json
  leaf          Leaf             @relation(fields: [leafId], references: [id])
  leafId        String           @unique
  leafIndex     Int
  merkleRootHex String
  vcFileKey     String
  status        CredentialStatus @default(ACTIVE)
  createdAt     DateTime         @default(now())
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
  id           String             @id @default(cuid())
  nullifierHex String
  disclosed    Json
  boundAddress String
  result       VerificationResult
  txHash       String?
  explorerUrl  String?
  jobGate      JobGate?           @relation(fields: [jobGateId], references: [id])
  jobGateId    String?
  createdAt    DateTime           @default(now())
}

model JobGate {
  id                String         @id @default(cuid())
  slug              String         @unique
  title             String
  description       String
  requiredPredicate Json
  rewardType        String
  rewardConfig      Json
  verifications     Verification[]
  claims            GateClaim[]
  createdAt         DateTime       @default(now())
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

> The Auth.js Credentials provider uses JWT sessions, so the Prisma adapter's `Account`/`Session`/`VerificationToken` tables are not required (SPEC §9 note). We attach `role`/`userId` via JWT callbacks (Task 12).

- [ ] **Step 4: Run the schema test to verify it passes**

Run: `pnpm --filter web test src/lib/__tests__/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Generate the client and create the migration (requires docker stack up)**

Run:
```bash
docker compose up -d
pnpm --filter web exec prisma migrate dev --name init
```
Expected: migration `..._init` created under `prisma/migrations/`; `prisma generate` runs; "Your database is now in sync with your schema."

- [ ] **Step 6: Commit**

```bash
git add apps/web/prisma/schema.prisma apps/web/prisma/migrations apps/web/src/lib/__tests__/schema.test.ts
git commit -m "feat(web): Prisma data model (SPEC §9) and initial migration"
```

---

### Task 7: `db.ts` (Prisma singleton), `redis.ts` (ioredis singleton)

**Files:**
- Create: `apps/web/src/lib/db.ts`, `apps/web/src/lib/redis.ts`
- Test: `apps/web/src/lib/__tests__/db.test.ts`

**Interfaces:**
- Produces:
  - `db: PrismaClient` — hot-reload-safe singleton. Consumed by `seed.ts`, `auth.config.ts`, health check, and every later service.
  - `redis: Redis` (ioredis) — singleton. Consumed by `ratelimit.ts` and the health check.

- [ ] **Step 1: Write the failing singleton test**

`apps/web/src/lib/__tests__/db.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@prisma/client", () => {
  return { PrismaClient: class { $queryRaw = vi.fn(); $disconnect = vi.fn(); } };
});

describe("db singleton", () => {
  it("returns the same PrismaClient instance across imports", async () => {
    const a = (await import("../db")).db;
    const b = (await import("../db")).db;
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter web test src/lib/__tests__/db.test.ts`
Expected: FAIL — `../db` not found.

- [ ] **Step 3: Implement `db.ts`**

```ts
import "server-only";
import { PrismaClient } from "@prisma/client";
import { env } from "./env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

- [ ] **Step 4: Implement `redis.ts`**

```ts
import "server-only";
import { Redis } from "ioredis";
import { env } from "./env";

const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis =
  globalForRedis.redis ??
  new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: false });

if (env.NODE_ENV !== "production") globalForRedis.redis = redis;
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter web test src/lib/__tests__/db.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/db.ts apps/web/src/lib/redis.ts apps/web/src/lib/__tests__/db.test.ts
git commit -m "feat(web): Prisma and ioredis hot-reload-safe singletons"
```

---

### Task 8: `ratelimit.ts` (rate-limiter-flexible + Redis)

**Files:**
- Create: `apps/web/src/lib/ratelimit.ts`
- Test: `apps/web/src/lib/__tests__/ratelimit.test.ts`

**Interfaces:**
- Produces:
  - `limiters: { auth; verify; register; mint }` — `RateLimiterRedis` instances at the Global-Constraint floors (auth 10/min, verify 20/min, register 5/min, mint 60/min).
  - `consumeOrThrow(limiter: RateLimiterRedis, key: string): Promise<void>` — consumes 1 point; on exhaustion throws `AppError("RATE_LIMITED", 429, ...)` carrying `Retry-After` seconds via `retryAfter`.
  - `clientIp(headers: Headers): string`.

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/__tests__/ratelimit.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { AppError } from "../errors";

vi.mock("../redis", () => ({ redis: {} }));
vi.mock("rate-limiter-flexible", () => {
  class RateLimiterRedis {
    points: number;
    constructor(opts: { points: number }) { this.points = opts.points; }
    async consume() { throw { msBeforeNext: 30000 }; } // simulate exhaustion
  }
  return { RateLimiterRedis };
});

describe("ratelimit", () => {
  it("configures floors and throws AppError 429 on exhaustion", async () => {
    const { limiters, consumeOrThrow } = await import("../ratelimit");
    expect((limiters.auth as unknown as { points: number }).points).toBe(10);
    expect((limiters.verify as unknown as { points: number }).points).toBe(20);
    expect((limiters.register as unknown as { points: number }).points).toBe(5);
    expect((limiters.mint as unknown as { points: number }).points).toBe(60);

    await expect(consumeOrThrow(limiters.register, "1.2.3.4")).rejects.toMatchObject({
      code: "RATE_LIMITED",
      httpStatus: 429,
    });
  });

  it("extracts the client IP", async () => {
    const { clientIp } = await import("../ratelimit");
    const h = new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" });
    expect(clientIp(h)).toBe("9.9.9.9");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter web test src/lib/__tests__/ratelimit.test.ts`
Expected: FAIL — `../ratelimit` not found.

- [ ] **Step 3: Implement `ratelimit.ts`**

```ts
import "server-only";
import { RateLimiterRedis } from "rate-limiter-flexible";
import { redis } from "./redis";
import { AppError } from "./errors";

function make(keyPrefix: string, points: number) {
  return new RateLimiterRedis({
    storeClient: redis,
    keyPrefix,
    points,
    duration: 60, // per minute
  });
}

export const limiters = {
  auth: make("rl:auth", 10),
  verify: make("rl:verify", 20),
  register: make("rl:register", 5),
  mint: make("rl:mint", 60),
};

export class RateLimitError extends AppError {
  constructor(public readonly retryAfter: number) {
    super("RATE_LIMITED", 429, "Too many requests. Please retry shortly.");
  }
}

export async function consumeOrThrow(
  limiter: RateLimiterRedis,
  key: string,
): Promise<void> {
  try {
    await limiter.consume(key, 1);
  } catch (res) {
    const ms = (res as { msBeforeNext?: number }).msBeforeNext ?? 60000;
    throw new RateLimitError(Math.ceil(ms / 1000));
  }
}

export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "0.0.0.0";
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter web test src/lib/__tests__/ratelimit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/ratelimit.ts apps/web/src/lib/__tests__/ratelimit.test.ts
git commit -m "feat(web): redis-backed rate limiters with 429 AppError"
```

---

### Task 9: `storage.ts` (S3/MinIO signed URLs)

**Files:**
- Create: `apps/web/src/lib/storage.ts`
- Test: `apps/web/src/lib/__tests__/storage.test.ts`

**Interfaces:**
- Produces:
  - `putVcJson(key: string, json: unknown): Promise<void>` — writes a VC JSON object to the private bucket.
  - `signedVcUrl(key: string, expiresSec?: number): Promise<string>` — short-lived (default 300s) signed GET URL. Consumed by Phase 4 mint and the holder VC download route (Phase 5).

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/__tests__/storage.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const send = vi.fn();
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class { send = send; },
  PutObjectCommand: class { constructor(public input: unknown) {} },
  GetObjectCommand: class { constructor(public input: unknown) {} },
}));
const getSignedUrl = vi.fn(async () => "https://signed.example/vc?sig=abc");
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl }));

vi.mock("../env", () => ({
  env: {
    S3_ENDPOINT: "http://localhost:9000",
    S3_REGION: "us-east-1",
    S3_BUCKET: "zelyo",
    S3_ACCESS_KEY_ID: "minioadmin",
    S3_SECRET_ACCESS_KEY: "minioadmin",
    S3_FORCE_PATH_STYLE: true,
  },
}));

describe("storage", () => {
  beforeEach(() => { send.mockReset(); getSignedUrl.mockClear(); });

  it("puts VC JSON as application/json", async () => {
    const { putVcJson } = await import("../storage");
    await putVcJson("vc/abc.json", { hello: "world" });
    expect(send).toHaveBeenCalledTimes(1);
    const cmd = send.mock.calls[0]![0] as { input: { ContentType: string; Bucket: string } };
    expect(cmd.input.ContentType).toBe("application/json");
    expect(cmd.input.Bucket).toBe("zelyo");
  });

  it("returns a short-lived signed url", async () => {
    const { signedVcUrl } = await import("../storage");
    const url = await signedVcUrl("vc/abc.json");
    expect(url).toContain("signed.example");
    expect(getSignedUrl).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter web test src/lib/__tests__/storage.test.ts`
Expected: FAIL — `../storage` not found.

- [ ] **Step 3: Implement `storage.ts`**

```ts
import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./env";

const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
});

export async function putVcJson(key: string, json: unknown): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: JSON.stringify(json),
      ContentType: "application/json",
    }),
  );
}

export async function signedVcUrl(key: string, expiresSec = 300): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
    { expiresIn: expiresSec },
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter web test src/lib/__tests__/storage.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/storage.ts apps/web/src/lib/__tests__/storage.test.ts
git commit -m "feat(web): private S3/MinIO storage with short-lived signed URLs"
```

---

### Task 10: `stellar.ts` (client + `publishRoot` from contract)

**Files:**
- Create: `apps/web/src/lib/stellar.ts`
- Test: `apps/web/src/lib/__tests__/stellar.test.ts`

**Interfaces:**
- Consumes: `CREDENTIAL_REGISTRY_CONTRACT_ID` + `ISSUER_SECRET` (env, server-only); the Soroban `CredentialRegistry.set_root(issuer, root)` from Phase 2.
- Produces (Cross-Phase Interface Contract): `publishRoot(rootHex: FieldHex): Promise<{ txHash: string }>` — builds, signs (`ISSUER_SECRET`), and submits a `set_root` invocation. Also exports `rpc` (Soroban `Server`), `issuerKeypair`, and `hexToBytes32(hex: FieldHex): Buffer`. Consumed by Phase 4 mint flow.

> `FieldHex` is `packages/zk-shared`'s branded type (Phase 1). Import it via the workspace package `@zelyo/zk-shared`. In this phase the function body is real; integration against testnet is exercised in Phase 4.

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/__tests__/stellar.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendTransaction = vi.fn(async () => ({ hash: "TXHASH123", status: "PENDING" }));
const getTransaction = vi.fn(async () => ({ status: "SUCCESS" }));
const prepareTransaction = vi.fn(async (tx: unknown) => tx);
const getAccount = vi.fn(async () => ({ accountId: () => "GISSUER", sequenceNumber: () => "1" }));

vi.mock("@stellar/stellar-sdk", () => {
  class Server {
    getAccount = getAccount;
    prepareTransaction = prepareTransaction;
    sendTransaction = sendTransaction;
    getTransaction = getTransaction;
  }
  return {
    rpc: { Server },
    Keypair: { fromSecret: () => ({ publicKey: () => "GISSUER", sign: vi.fn() }) },
    Contract: class { constructor(public id: string) {} call() { return {}; } },
    TransactionBuilder: class {
      addOperation() { return this; }
      setTimeout() { return this; }
      build() { return { sign: vi.fn(), hash: () => Buffer.alloc(32) }; }
    },
    BASE_FEE: "100",
    Networks: { TESTNET: "Test SDF Network ; September 2015" },
    nativeToScVal: (v: unknown) => v,
    Address: class { constructor(public a: string) {} toScVal() { return {}; } },
  };
});

vi.mock("../env", () => ({
  env: {
    SOROBAN_RPC_URL: "https://soroban-testnet.stellar.org",
    NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
    ISSUER_SECRET: "SISSUERSECRET",
    ISSUER_STELLAR_ACCOUNT: "GISSUER",
    CREDENTIAL_REGISTRY_CONTRACT_ID: "CREGISTRY",
  },
}));

describe("stellar.publishRoot", () => {
  beforeEach(() => { sendTransaction.mockClear(); });

  it("converts a 0x root to 32 bytes", async () => {
    const { hexToBytes32 } = await import("../stellar");
    const buf = hexToBytes32(("0x" + "ab".repeat(32)) as never);
    expect(buf.length).toBe(32);
    expect(buf[0]).toBe(0xab);
  });

  it("signs and submits set_root and returns the tx hash", async () => {
    const { publishRoot } = await import("../stellar");
    const res = await publishRoot(("0x" + "01".repeat(32)) as never);
    expect(res.txHash).toBe("TXHASH123");
    expect(sendTransaction).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter web test src/lib/__tests__/stellar.test.ts`
Expected: FAIL — `../stellar` not found.

- [ ] **Step 3: Implement `stellar.ts`**

```ts
import "server-only";
import {
  rpc,
  Keypair,
  Contract,
  TransactionBuilder,
  BASE_FEE,
  Address,
  nativeToScVal,
} from "@stellar/stellar-sdk";
import type { FieldHex } from "@zelyo/zk-shared";
import { env } from "./env";

export const rpcServer = new rpc.Server(env.SOROBAN_RPC_URL, {
  allowHttp: env.SOROBAN_RPC_URL.startsWith("http://"),
});
export const issuerKeypair = Keypair.fromSecret(env.ISSUER_SECRET);

/** 0x-prefixed 32-byte field hex -> 32-byte Buffer (BytesN<32>). */
export function hexToBytes32(hex: FieldHex): Buffer {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length !== 64) throw new Error("root must be 32 bytes (64 hex chars)");
  return Buffer.from(clean, "hex");
}

/**
 * Publish a Merkle root on-chain via CredentialRegistry.set_root(issuer, root).
 * Signed server-side with ISSUER_SECRET. Returns the submitted tx hash.
 */
export async function publishRoot(rootHex: FieldHex): Promise<{ txHash: string }> {
  const contract = new Contract(env.CREDENTIAL_REGISTRY_CONTRACT_ID);
  const source = await rpcServer.getAccount(issuerKeypair.publicKey());

  const op = contract.call(
    "set_root",
    new Address(env.ISSUER_STELLAR_ACCOUNT).toScVal(),
    nativeToScVal(hexToBytes32(rootHex), { type: "bytes" }),
  );

  let tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: env.NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(60)
    .build();

  tx = await rpcServer.prepareTransaction(tx);
  tx.sign(issuerKeypair);

  const sent = await rpcServer.sendTransaction(tx);
  return { txHash: sent.hash };
}
```

> Wire `@zelyo/zk-shared` into `apps/web/package.json` dependencies as `"workspace:*"` if Phase 1 has not already; the type import is erased at runtime so the test mock needs no real package.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter web test src/lib/__tests__/stellar.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/stellar.ts apps/web/src/lib/__tests__/stellar.test.ts apps/web/package.json
git commit -m "feat(web): stellar client and publishRoot (set_root) signer"
```

---

### Task 11: Idempotent seed (admin argon2id, issuer, empty depth-20 tree, data-engineering gate)

**Files:**
- Create: `apps/web/prisma/seed.ts`
- Test: `apps/web/prisma/__tests__/seed.test.ts`

**Interfaces:**
- Consumes: `db` (Task 7), `env` (Task 4), `@node-rs/argon2`, `MERKLE_DEPTH` + empty-tree root from `@zelyo/zk-shared` (Phase 1).
- Produces: a `seed()` function (default export runner). After run: admin `User` (role `ADMIN`, argon2id hash), one `Issuer`, one empty `MerkleTree` (depth 20, `rootHex` = empty-tree root, `leafCount` 0), one `JobGate` `data-engineering` (`requiredPredicate {attribute:"track", equals:"Data Engineering"}`, reward `CLAIMABLE_BALANCE`). Re-running changes nothing (upserts).

- [ ] **Step 1: Write the failing idempotency test**

`apps/web/prisma/__tests__/seed.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

const store = { users: 0, issuers: 0, trees: 0, gates: 0 };
const upsert = (k: keyof typeof store) =>
  vi.fn(async () => { store[k] = 1; return {}; }); // idempotent: count never exceeds 1

vi.mock("../../src/lib/db", () => ({
  db: {
    user: { upsert: upsert("users") },
    issuer: { upsert: upsert("issuers"), findFirst: vi.fn(async () => null) },
    merkleTree: { upsert: upsert("trees"), findFirst: vi.fn(async () => null) },
    jobGate: { upsert: upsert("gates") },
    $disconnect: vi.fn(),
  },
}));
vi.mock("@node-rs/argon2", () => ({ hash: vi.fn(async () => "$argon2id$hash"), Algorithm: { Argon2id: 2 } }));
vi.mock("@zelyo/zk-shared", () => ({ MERKLE_DEPTH: 20, emptyTreeRoot: () => "0x" + "00".repeat(32) }));
vi.mock("../../src/lib/env", () => ({
  env: {
    ADMIN_USERNAME: "admin",
    ADMIN_PASSWORD: "a-strong-password",
    ISSUER_NAME: "Institute of Distributed Systems",
    ISSUER_STELLAR_ACCOUNT: "GISSUER",
  },
}));

describe("seed", () => {
  it("is idempotent: running twice yields one of each entity", async () => {
    const { seed } = await import("../seed");
    await seed();
    await seed();
    expect(store).toEqual({ users: 1, issuers: 1, trees: 1, gates: 1 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter web test prisma/__tests__/seed.test.ts`
Expected: FAIL — `../seed` not found.

- [ ] **Step 3: Implement `prisma/seed.ts`**

```ts
import { hash, Algorithm } from "@node-rs/argon2";
import { MERKLE_DEPTH, emptyTreeRoot } from "@zelyo/zk-shared";
import { db } from "../src/lib/db";
import { env } from "../src/lib/env";

async function hashPassword(plain: string): Promise<string> {
  return hash(plain, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19456, // ~19 MiB (OWASP-recommended floor)
    timeCost: 2,
    parallelism: 1,
  });
}

export async function seed(): Promise<void> {
  // Admin user (idempotent on unique username).
  await db.user.upsert({
    where: { username: env.ADMIN_USERNAME },
    update: {},
    create: {
      username: env.ADMIN_USERNAME,
      passwordHash: await hashPassword(env.ADMIN_PASSWORD),
      role: "ADMIN",
    },
  });

  // One issuer. No natural unique key in the model, so guard with findFirst.
  const existingIssuer = await db.issuer.findFirst({ where: { name: env.ISSUER_NAME } });
  if (!existingIssuer) {
    await db.issuer.create({
      data: { name: env.ISSUER_NAME, stellarAccount: env.ISSUER_STELLAR_ACCOUNT },
    });
  }

  // Empty depth-20 Merkle tree with the canonical empty-tree root.
  const existingTree = await db.merkleTree.findFirst();
  if (!existingTree) {
    await db.merkleTree.create({
      data: { depth: MERKLE_DEPTH, rootHex: emptyTreeRoot(), leafCount: 0 },
    });
  }

  // Demo job gate (idempotent on unique slug).
  await db.jobGate.upsert({
    where: { slug: "data-engineering" },
    update: {},
    create: {
      slug: "data-engineering",
      title: "Data Engineering Graduate",
      description:
        "Prove, in zero knowledge, that you hold a credential whose track is Data Engineering — without revealing name or grade.",
      requiredPredicate: { attribute: "track", equals: "Data Engineering" },
      rewardType: "CLAIMABLE_BALANCE",
      rewardConfig: { asset: "native", amount: "10" },
    },
  });
}

seed()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error("Seed failed:", e instanceof Error ? e.message : e);
    await db.$disconnect();
    process.exit(1);
  });
```

> `emptyTreeRoot()` and `MERKLE_DEPTH` come from `@zelyo/zk-shared` (Phase 1), so the seed's empty-tree root matches the circuit's Poseidon zero-subtree exactly. If Phase 1 has not yet exported `emptyTreeRoot`, add it there (a function returning the depth-20 all-zero-leaf root) — do not hardcode a literal here.

- [ ] **Step 4: Run the seed test to verify it passes**

Run: `pnpm --filter web test prisma/__tests__/seed.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the real seed against the docker stack**

Run:
```bash
docker compose up -d
pnpm --filter web exec prisma migrate deploy
ADMIN_PASSWORD=dev-admin-pass pnpm --filter web db:seed
pnpm --filter web db:seed   # second run proves idempotency (no errors, no dupes)
```
Expected: both runs succeed; `psql` shows exactly 1 admin, 1 issuer, 1 tree, 1 gate.

- [ ] **Step 6: Commit**

```bash
git add apps/web/prisma/seed.ts apps/web/prisma/__tests__/seed.test.ts
git commit -m "feat(web): idempotent seed (admin, issuer, empty tree, demo gate)"
```

---

### Task 12: Auth.js v5 — `auth.config.ts`, `auth.ts` (Credentials + argon2id + JWT callbacks)

**Files:**
- Create: `apps/web/auth.config.ts`, `apps/web/auth.ts`
- Create: `apps/web/src/lib/validation/auth.ts`
- Create: `apps/web/src/app/api/auth/[...nextauth]/route.ts`
- Create: `apps/web/types/next-auth.d.ts`
- Test: `apps/web/src/lib/__tests__/auth-callbacks.test.ts`

**Interfaces:**
- Consumes: `db` (Task 7), `env` (Task 4), `@node-rs/argon2.verify`, the auth Zod schema.
- Produces:
  - `src/lib/validation/auth.ts`: `credentialsSchema` (username/password) and `registerSchema` (username 3–32, password min 8) — shared client + server.
  - `auth.config.ts`: edge-safe base config with `callbacks.authorized` for middleware and `callbacks.jwt`/`callbacks.session` attaching `role` + `userId`.
  - `auth.ts`: full config with the Credentials provider (`authorize()` verifying argon2id; returns `{ id, username, role }` or `null`), `session.strategy = "jwt"`, exporting `handlers`, `auth`, `signIn`, `signOut`.
  - Module augmentation so `session.user.role: Role` and `session.user.id: string` are typed. Consumed by middleware (Task 13) and every handler's RBAC re-check.

- [ ] **Step 1: Write the failing callbacks test**

`apps/web/src/lib/__tests__/auth-callbacks.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { authConfig } from "../../../auth.config";

describe("auth callbacks", () => {
  it("threads userId + role into the JWT and session", async () => {
    const jwt = authConfig.callbacks!.jwt!;
    const session = authConfig.callbacks!.session!;

    const token = await jwt({
      token: {},
      user: { id: "u1", username: "admin", role: "ADMIN" },
    } as never);
    expect(token).toMatchObject({ userId: "u1", role: "ADMIN" });

    const sess = await session({
      session: { user: {} },
      token: { userId: "u1", role: "ADMIN" },
    } as never);
    expect((sess as { user: { id: string; role: string } }).user).toMatchObject({
      id: "u1",
      role: "ADMIN",
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter web test src/lib/__tests__/auth-callbacks.test.ts`
Expected: FAIL — `auth.config` not found.

- [ ] **Step 3: Implement the shared validation schema**

`apps/web/src/lib/validation/auth.ts`:

```ts
import { z } from "zod";

export const credentialsSchema = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(1).max(200),
});

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, "At least 3 characters")
    .max(32)
    .regex(/^[a-zA-Z0-9_-]+$/, "Letters, numbers, _ and - only"),
  password: z.string().min(8, "At least 8 characters").max(200),
});

export type RegisterInput = z.infer<typeof registerSchema>;
```

- [ ] **Step 4: Implement `types/next-auth.d.ts` (module augmentation)**

```ts
import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string; role: Role } & DefaultSession["user"];
  }
  interface User {
    role: Role;
    username: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    role: Role;
  }
}
```

- [ ] **Step 5: Implement `auth.config.ts` (edge-safe, no Node-only imports)**

```ts
import type { NextAuthConfig } from "next-auth";

// Edge-safe base config. No db / argon2 imports here (middleware runs on edge).
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id as string;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId;
        session.user.role = token.role;
      }
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const role = auth?.user?.role;
      const needsAdmin = pathname.startsWith("/issuer") || pathname.startsWith("/admin");
      const needsHolder = pathname.startsWith("/wallet");
      if (!needsAdmin && !needsHolder) return true;
      if (!auth) return false; // middleware redirects to signIn page
      if (needsAdmin) return role === "ADMIN";
      if (needsHolder) return role === "HOLDER";
      return true;
    },
  },
  providers: [], // declared in auth.ts (Credentials needs Node-only argon2)
} satisfies NextAuthConfig;
```

- [ ] **Step 6: Implement `auth.ts` (full config with Credentials provider)**

```ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verify } from "@node-rs/argon2";
import { authConfig } from "./auth.config";
import { credentialsSchema } from "./src/lib/validation/auth";
import { db } from "./src/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  providers: [
    Credentials({
      credentials: { username: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { username, password } = parsed.data;

        const user = await db.user.findUnique({ where: { username } });
        // Constant-ish time: always run a verify even when the user is missing.
        const hashToCheck =
          user?.passwordHash ??
          "$argon2id$v=19$m=19456,t=2,p=1$ZGVjb3lkZWNveWRlY295$0000000000000000000000000000000000000000000";
        const ok = await verify(hashToCheck, password).catch(() => false);

        if (!user || !ok) return null; // generic failure — never reveal which field
        return { id: user.id, username: user.username, role: user.role };
      },
    }),
  ],
});
```

- [ ] **Step 7: Implement the Auth.js route handler**

`apps/web/src/app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from "../../../../../auth";
export const { GET, POST } = handlers;
```

- [ ] **Step 8: Run the callbacks test to verify it passes**

Run: `pnpm --filter web test src/lib/__tests__/auth-callbacks.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/web/auth.config.ts apps/web/auth.ts apps/web/src/lib/validation/auth.ts \
  apps/web/types/next-auth.d.ts "apps/web/src/app/api/auth/[...nextauth]/route.ts" \
  apps/web/src/lib/__tests__/auth-callbacks.test.ts
git commit -m "feat(web): Auth.js v5 Credentials + argon2id with role/userId JWT"
```

---

### Task 13: RBAC middleware

**Files:**
- Create: `apps/web/src/middleware.ts`
- Test: `apps/web/src/__tests__/middleware-matcher.test.ts`

**Interfaces:**
- Consumes: `auth` (the edge wrapper) from `auth.config.ts` via `NextAuth(authConfig).auth`.
- Produces: middleware enforcing `ADMIN` → `/issuer/**`,`/admin/**`; `HOLDER` → `/wallet/**`; unauthenticated → redirect `/login`; the `config.matcher` covering those trees. RBAC is re-checked in each handler (handlers added in later phases).

- [ ] **Step 1: Write the failing matcher test**

`apps/web/src/__tests__/middleware-matcher.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { config } from "../middleware";

describe("middleware matcher", () => {
  it("guards the protected route trees and skips static/api", () => {
    expect(config.matcher).toContain("/issuer/:path*");
    expect(config.matcher).toContain("/admin/:path*");
    expect(config.matcher).toContain("/wallet/:path*");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter web test src/__tests__/middleware-matcher.test.ts`
Expected: FAIL — `../middleware` not found.

- [ ] **Step 3: Implement `src/middleware.ts`**

```ts
import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "../auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const role = req.auth?.user?.role;

  const needsAdmin = pathname.startsWith("/issuer") || pathname.startsWith("/admin");
  const needsHolder = pathname.startsWith("/wallet");
  if (!needsAdmin && !needsHolder) return NextResponse.next();

  if (!req.auth) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (needsAdmin && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }
  if (needsHolder && role !== "HOLDER") {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/issuer/:path*", "/admin/:path*", "/wallet/:path*"],
};
```

- [ ] **Step 4: Run the matcher test to verify it passes**

Run: `pnpm --filter web test src/__tests__/middleware-matcher.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/middleware.ts apps/web/src/__tests__/middleware-matcher.test.ts
git commit -m "feat(web): RBAC middleware for issuer/admin/wallet trees"
```

---

### Task 14: `/api/holder/register` + `/login` and `/register` pages

**Files:**
- Create: `apps/web/src/app/api/holder/register/route.ts`
- Create: `apps/web/src/server/holder.service.ts`
- Create: `apps/web/src/app/(auth)/login/page.tsx`, `apps/web/src/app/(auth)/login/LoginForm.tsx`
- Create: `apps/web/src/app/(auth)/register/page.tsx`, `apps/web/src/app/(auth)/register/RegisterForm.tsx`
- Test: `apps/web/src/server/__tests__/holder.service.test.ts`, `apps/web/src/app/api/holder/register/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `db`, `registerSchema`, `@node-rs/argon2.hash`, `AppError`/`toErrorResponse`, `limiters.register` + `consumeOrThrow` + `clientIp`, `signIn`.
- Produces:
  - `holder.service.ts`: `registerHolder(input: RegisterInput): Promise<{ id: string; username: string }>` — creates a `HOLDER` user with an argon2id hash; throws `AppError("USERNAME_TAKEN", 409, ...)` on duplicate. (No `s`, no `id_commitment` here — those are client-side, set later via `/api/holder/commitment`.)
  - `POST /api/holder/register`: thin handler (rate-limit → validate → service → 201) returning `{ id, username }`.
  - `/login`, `/register` pages styled to BRAND with one foil-stamp CTA each.

- [ ] **Step 1: Write the failing service test**

`apps/web/src/server/__tests__/holder.service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
vi.mock("../../lib/db", () => ({ db: { user: { create } } }));
vi.mock("@node-rs/argon2", () => ({ hash: vi.fn(async () => "$argon2id$h"), Algorithm: { Argon2id: 2 } }));

describe("registerHolder", () => {
  beforeEach(() => create.mockReset());

  it("creates a HOLDER with a hashed password (never plaintext)", async () => {
    create.mockResolvedValueOnce({ id: "u9", username: "alice" });
    const { registerHolder } = await import("../holder.service");
    const res = await registerHolder({ username: "alice", password: "supersecret" });
    expect(res).toEqual({ id: "u9", username: "alice" });
    const arg = create.mock.calls[0]![0].data;
    expect(arg.role).toBe("HOLDER");
    expect(arg.passwordHash).toBe("$argon2id$h");
    expect(JSON.stringify(arg)).not.toContain("supersecret");
  });

  it("maps a unique-violation to USERNAME_TAKEN 409", async () => {
    create.mockRejectedValueOnce({ code: "P2002" });
    const { registerHolder } = await import("../holder.service");
    await expect(registerHolder({ username: "bob", password: "supersecret" })).rejects.toMatchObject({
      code: "USERNAME_TAKEN",
      httpStatus: 409,
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter web test src/server/__tests__/holder.service.test.ts`
Expected: FAIL — `../holder.service` not found.

- [ ] **Step 3: Implement `holder.service.ts`**

```ts
import "server-only";
import { hash, Algorithm } from "@node-rs/argon2";
import { db } from "../lib/db";
import { AppError } from "../lib/errors";
import type { RegisterInput } from "../lib/validation/auth";

export async function registerHolder(
  input: RegisterInput,
): Promise<{ id: string; username: string }> {
  const passwordHash = await hash(input.password, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  try {
    const user = await db.user.create({
      data: { username: input.username, passwordHash, role: "HOLDER" },
      select: { id: true, username: true },
    });
    return user;
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      throw new AppError("USERNAME_TAKEN", 409, "That username is already taken.");
    }
    throw e;
  }
}
```

- [ ] **Step 4: Write the failing route test**

`apps/web/src/app/api/holder/register/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const registerHolder = vi.fn();
const consumeOrThrow = vi.fn();
vi.mock("@/server/holder.service", () => ({ registerHolder }));
vi.mock("@/lib/ratelimit", () => ({
  limiters: { register: {} },
  consumeOrThrow,
  clientIp: () => "1.1.1.1",
}));

function req(body: unknown) {
  return new Request("http://localhost/api/holder/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/holder/register", () => {
  beforeEach(() => { registerHolder.mockReset(); consumeOrThrow.mockReset(); });

  it("201 on success", async () => {
    registerHolder.mockResolvedValueOnce({ id: "u1", username: "alice" });
    const { POST } = await import("../route");
    const res = await POST(req({ username: "alice", password: "supersecret" }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "u1", username: "alice" });
  });

  it("400 on invalid body", async () => {
    const { POST } = await import("../route");
    const res = await POST(req({ username: "a", password: "x" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION");
  });

  it("429 when rate limited", async () => {
    consumeOrThrow.mockRejectedValueOnce(
      Object.assign(new Error("rl"), { code: "RATE_LIMITED", httpStatus: 429, publicMessage: "Too many requests. Please retry shortly." }),
    );
    const { POST } = await import("../route");
    const res = await POST(req({ username: "alice", password: "supersecret" }));
    expect(res.status).toBe(429);
  });
});
```

- [ ] **Step 5: Run to verify it fails**

Run: `pnpm --filter web test src/app/api/holder/register/__tests__/route.test.ts`
Expected: FAIL — `../route` not found.

- [ ] **Step 6: Implement the route handler**

`apps/web/src/app/api/holder/register/route.ts`:

```ts
import { NextResponse } from "next/server";
import { registerSchema } from "@/lib/validation/auth";
import { registerHolder } from "@/server/holder.service";
import { AppError, toErrorResponse } from "@/lib/errors";
import { limiters, consumeOrThrow, clientIp } from "@/lib/ratelimit";

export async function POST(request: Request) {
  try {
    await consumeOrThrow(limiters.register, clientIp(request.headers));

    const json = await request.json().catch(() => null);
    const parsed = registerSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError("VALIDATION", 400, "Invalid registration details.");
    }

    const user = await registerHolder(parsed.data);
    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    const headers =
      status === 429 ? { "Retry-After": String((err as { retryAfter?: number }).retryAfter ?? 60) } : undefined;
    return NextResponse.json(body, { status, ...(headers ? { headers } : {}) });
  }
}
```

- [ ] **Step 7: Run the route test to verify it passes**

Run: `pnpm --filter web test src/app/api/holder/register/__tests__/route.test.ts`
Expected: PASS.

- [ ] **Step 8: Implement the `/login` page + client form**

`apps/web/src/app/(auth)/login/page.tsx`:

```tsx
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-margin-mobile">
      <p className="font-label text-label-md uppercase tracking-[0.05em] text-secondary">
        The Zelyo Registry
      </p>
      <h1 className="mt-stack-sm font-display text-headline-md text-primary">Sign in</h1>
      <p className="mt-stack-sm font-body text-body-md italic text-on-surface-variant">
        Enter your credentials to access the registry.
      </p>
      <LoginForm />
    </main>
  );
}
```

`apps/web/src/app/(auth)/login/LoginForm.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { credentialsSchema } from "@/lib/validation/auth";
import { Input } from "@/components/Input";
import { FoilStampButton } from "@/components/FoilStampButton";
import type { z } from "zod";

type Values = z.infer<typeof credentialsSchema>;

export function LoginForm() {
  const router = useRouter();
  const callbackUrl = useSearchParams().get("callbackUrl") ?? "/";
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(credentialsSchema),
  });

  async function onSubmit(values: Values) {
    setError(null);
    const res = await signIn("credentials", { ...values, redirect: false });
    if (res?.error) setError("Invalid credentials.");
    else router.push(callbackUrl);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-stack-lg flex flex-col gap-stack-md">
      <Input label="Username" {...register("username")} />
      <Input label="Password" type="password" {...register("password")} />
      {error && <p className="font-body text-body-md text-error">{error}</p>}
      <FoilStampButton type="submit" disabled={formState.isSubmitting}>
        Enter the Registry
      </FoilStampButton>
      <a href="/register" className="font-label text-label-md uppercase tracking-[0.05em] text-secondary hover:text-primary">
        Create a holder account
      </a>
    </form>
  );
}
```

> Note: `Input`'s `name` is supplied by react-hook-form's `register("username")` spread (which provides `name`); pass `label` explicitly. Because `Input` declares `name` required, the spread satisfies it.

- [ ] **Step 9: Implement the `/register` page + client form**

`apps/web/src/app/(auth)/register/page.tsx`:

```tsx
import { RegisterForm } from "./RegisterForm";

export default function RegisterPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-margin-mobile">
      <p className="font-label text-label-md uppercase tracking-[0.05em] text-secondary">
        Identity Folio
      </p>
      <h1 className="mt-stack-sm font-display text-headline-md text-primary">Open a folio</h1>
      <p className="mt-stack-sm font-body text-body-md italic text-on-surface-variant">
        Your holder secret is generated on your device on first wallet visit — never here, never on our servers.
      </p>
      <RegisterForm />
    </main>
  );
}
```

`apps/web/src/app/(auth)/register/RegisterForm.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { registerSchema, type RegisterInput } from "@/lib/validation/auth";
import { Input } from "@/components/Input";
import { FoilStampButton } from "@/components/FoilStampButton";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  async function onSubmit(values: RegisterInput) {
    setError(null);
    const res = await fetch("/api/holder/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { message: string } } | null;
      setError(body?.error?.message ?? "Registration failed.");
      return;
    }
    await signIn("credentials", { ...values, redirect: false });
    router.push("/wallet");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-stack-lg flex flex-col gap-stack-md">
      <Input label="Username" {...register("username")} />
      {formState.errors.username && (
        <p className="font-body text-caption text-error">{formState.errors.username.message}</p>
      )}
      <Input label="Password" type="password" {...register("password")} />
      {formState.errors.password && (
        <p className="font-body text-caption text-error">{formState.errors.password.message}</p>
      )}
      {error && <p className="font-body text-body-md text-error">{error}</p>}
      <FoilStampButton type="submit" disabled={formState.isSubmitting}>
        Open Folio
      </FoilStampButton>
    </form>
  );
}
```

> Add `next-auth/react` usage requires no extra config; `signIn` from `next-auth/react` is the client entry. The route group `(auth)` keeps `/login` and `/register` URLs clean.

- [ ] **Step 10: Run the full auth-related suite + typecheck**

Run: `pnpm --filter web test src/server src/app/api/holder && pnpm --filter web typecheck`
Expected: PASS; typecheck clean (no `any`, augmented `session.user.role` recognized).

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/server/holder.service.ts \
  apps/web/src/app/api/holder/register apps/web/src/server/__tests__ \
  "apps/web/src/app/(auth)"
git commit -m "feat(web): holder register service+route and login/register pages"
```

---

### Task 15: `GET /api/health` (db, redis, rpc readiness)

**Files:**
- Create: `apps/web/src/app/api/health/route.ts`
- Test: `apps/web/src/app/api/health/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `db.$queryRaw`, `redis.ping`, `rpcServer.getHealth` (Soroban RPC).
- Produces: `GET /api/health` → `200 { status: "ok", checks: { db, redis, rpc } }` when all healthy; `503 { status: "degraded", checks }` when any fails. No secrets in the body.

- [ ] **Step 1: Write the failing test**

`apps/web/src/app/api/health/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const queryRaw = vi.fn();
const ping = vi.fn();
const getHealth = vi.fn();
vi.mock("@/lib/db", () => ({ db: { $queryRaw: queryRaw } }));
vi.mock("@/lib/redis", () => ({ redis: { ping } }));
vi.mock("@/lib/stellar", () => ({ rpcServer: { getHealth } }));

describe("GET /api/health", () => {
  beforeEach(() => { queryRaw.mockReset(); ping.mockReset(); getHealth.mockReset(); });

  it("200 when all dependencies are healthy", async () => {
    queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);
    ping.mockResolvedValueOnce("PONG");
    getHealth.mockResolvedValueOnce({ status: "healthy" });
    const { GET } = await import("../route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: "ok", checks: { db: true, redis: true, rpc: true } });
  });

  it("503 when a dependency fails", async () => {
    queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);
    ping.mockRejectedValueOnce(new Error("down"));
    getHealth.mockResolvedValueOnce({ status: "healthy" });
    const { GET } = await import("../route");
    const res = await GET();
    expect(res.status).toBe(503);
    expect((await res.json()).checks.redis).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter web test src/app/api/health/__tests__/route.test.ts`
Expected: FAIL — `../route` not found.

- [ ] **Step 3: Implement `/api/health`**

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { rpcServer } from "@/lib/stellar";

export const dynamic = "force-dynamic";

async function check(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const [dbOk, redisOk, rpcOk] = await Promise.all([
    check(() => db.$queryRaw`SELECT 1`),
    check(() => redis.ping()),
    check(() => rpcServer.getHealth()),
  ]);
  const checks = { db: dbOk, redis: redisOk, rpc: rpcOk };
  const allOk = dbOk && redisOk && rpcOk;
  return NextResponse.json(
    { status: allOk ? "ok" : "degraded", checks },
    { status: allOk ? 200 : 503 },
  );
}
```

- [ ] **Step 4: Run the health test to verify it passes**

Run: `pnpm --filter web test src/app/api/health/__tests__/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify green against the live stack**

Run:
```bash
docker compose up -d
pnpm --filter web dev &   # then in another shell:
curl -s http://localhost:3000/api/health | jq
```
Expected (RPC reachable): `{"status":"ok","checks":{"db":true,"redis":true,"rpc":true}}` with HTTP 200.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/health
git commit -m "feat(web): /api/health readiness probe (db, redis, rpc)"
```

---

### Task 16: Full-suite gate — typecheck, lint, all tests, boot smoke

**Files:**
- Modify: none (verification task). May touch config if a check surfaces an issue.

**Interfaces:** none.

- [ ] **Step 1: Typecheck the whole app**

Run: `pnpm --filter web typecheck`
Expected: PASS — no `any`, `noUncheckedIndexedAccess`/`exactOptionalPropertyTypes` clean, augmented session types recognized.

- [ ] **Step 2: Lint**

Run: `pnpm --filter web lint`
Expected: PASS — no errors.

- [ ] **Step 3: Run the entire unit suite**

Run: `pnpm --filter web test`
Expected: PASS — headers, theme, 10 components, env, errors, logger, schema, db, ratelimit, storage, stellar, seed, auth-callbacks, middleware-matcher, holder.service, register route, health route.

- [ ] **Step 4: Production build smoke**

Run: `pnpm --filter web build`
Expected: build succeeds; security headers present; no missing-utility/theme errors.

- [ ] **Step 5: Manual RBAC + auth smoke against the live stack**

Run `docker compose up -d`, `pnpm --filter web db:migrate`, `pnpm --filter web db:seed`, `pnpm --filter web dev`, then verify:
- Unauthenticated GET `/wallet` and `/issuer` → 307 redirect to `/login?callbackUrl=...`.
- Register a holder at `/register` → lands on `/wallet`; that session cannot reach `/issuer` (redirect to `/login`).
- Sign in as the seeded admin at `/login` → can reach `/issuer`; cannot reach `/wallet` (redirect).
- `/` and `/login` render with the BRAND theme (paper background, EB Garamond display, foil-stamp CTA with shine).
- `curl /api/health` → `200 status:"ok"`.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "chore(web): phase 3 verification fixes"
```

---

## Phase Gate

Do not start Phase 4 until **all** of these pass:

- [ ] `pnpm --filter web typecheck` clean (strict, no `any`).
- [ ] `pnpm --filter web lint` clean.
- [ ] `pnpm --filter web test` green (all unit/RTL suites in Tasks 1–15).
- [ ] `pnpm --filter web build` succeeds; `next.config.ts` emits CSP + `X-Frame-Options: DENY` + `X-Content-Type-Options: nosniff` + `Referrer-Policy` + minimal `Permissions-Policy` + **`Cross-Origin-Opener-Policy: same-origin`** + **`Cross-Origin-Embedder-Policy: require-corp`** on `/(.*)`.
- [ ] **App boots:** `pnpm --filter web dev` serves `/`, `/login`, `/register` with the BRAND theme rendering (warm paper `#fbf9f5`, EB Garamond display, Hanken uppercase labels, a single foil-stamp CTA per view with the shine sweep, reduced-motion respected).
- [ ] **Migrate + seed succeed and are idempotent:** `prisma migrate dev` then `db:seed` run twice with no errors and exactly one admin / issuer / depth-20 empty tree (`rootHex` = `zk-shared` empty-tree root) / `data-engineering` gate.
- [ ] **Login/register + RBAC work:** holder self-registers and reaches `/wallet` but is redirected away from `/issuer`; seeded admin reaches `/issuer`/`/admin` but is redirected away from `/wallet`; unauthenticated users hitting any protected tree are redirected to `/login`. Auth errors are generic ("Invalid credentials").
- [ ] **Health green:** `GET /api/health` returns `200 {status:"ok",checks:{db:true,redis:true,rpc:true}}` against the docker stack + testnet RPC.
- [ ] No secret/PII is logged or shipped to the client; `ISSUER_SECRET`/`AUTH_SECRET` are server-only and never `NEXT_PUBLIC_`; every new env key is in `.env.example` **and** `src/lib/env.ts`.
