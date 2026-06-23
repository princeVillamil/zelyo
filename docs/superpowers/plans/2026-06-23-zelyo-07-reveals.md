# Phase 6 — Reveals & Money-Rails

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the three acceptance reveals (`SPEC.md §13`): the `/verify/result/[txHash]` explorer panel that proves nothing personal is on-chain, the live Sybil-block UX (second submit → `NULLIFIER_USED`), and the public job board where a selective-disclosure proof unlocks a Stellar-native `GateClaim` — plus the landing `/` three-reveal narrative.

**Prerequisites:** Phase 2 (registry events/nullifier), Phase 3 (components), Phase 5 (prove/verify flow + verification records)

**Gate:** `pnpm --filter web typecheck && pnpm --filter web lint && pnpm --filter web test` green; the three Phase-Gate checks at the end pass; `/`, `/jobs`, `/jobs/[slug]`, `/verify/result/[txHash]` render against the docker-compose stack and visibly match `BRAND.md`.

**Architecture:** This phase is the "surface" layer over the Phase 5 spine. The chain already enforces Sybil-resistance and records only `(nullifier, root, boundAddress)`; this phase reads `Verification`/`Nullifier` mirror rows and renders them. The job board adds one new server service — `jobgate.service.ts` — that, given a `Verified` matching a gate's predicate, either issues a testnet claimable balance to `boundAddress` (`rewardType = "CLAIMABLE_BALANCE"`) or flips an on-chain `is_verified(address)` flag (`rewardType = "FLAG"`), recording a `GateClaim` unique per `(gate, nullifier)`. Public routes are thin (validate → service → typed response), rate-limited, and audit-logged.

**Tech Stack:** Next.js 16.2 App Router (Server Components default; Client Components only for the prove deep-link + Sybil-retry UI) · React 19.2 · TypeScript 6 strict · Tailwind v4.3 (`@theme` tokens from `BRAND.md`) · Prisma 7.8 + Postgres 16 · `@stellar/stellar-sdk` 16 (Horizon claimable balances + Soroban contract invoke) · Zod 4 · `rate-limiter-flexible` 11 + `ioredis` 5 · Vitest 4.

## Global Constraints

These apply to **every task** below. Values copied verbatim from `SPEC.md` / `AGENT.md` / the index.

- **Privacy is the product.** Personal data (name/grade/attributes) never goes on-chain, in logs, in analytics, or in client bundles. The only on-chain payload is the nullifier hash + proof + root + boundAddress. The job board reads `track` (the single disclosed predicate) only.
- **The chain is the source of truth** for nullifier uniqueness and root validity; Postgres is a UX mirror and never authorizes anything. `claimGate` requires a real `VERIFIED` `Verification` row that itself references an on-chain `txHash`.
- **TypeScript:** `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. No `any`; `unknown` + Zod at boundaries.
- **Route handlers are thin:** validate (Zod) → authorize → call a `src/server/*` service → map to typed response. Business logic in services.
- **Errors:** throw typed `AppError(code, httpStatus, publicMessage)`; the single error boundary maps to `{ error: { code, message } }`. Never leak stack traces or DB errors.
- **Rate limits** (`rate-limiter-flexible` + Redis, per IP): `/api/jobboard/*/claim` is a mutating public route — limit to **10/min**, return `429` with `Retry-After`. `GET` board routes are unmetered but cacheable.
- **Audit:** log claim attempts (success + rejection) to `AuditLog` with `action`, `target = slug`, `ip`, `meta` (no PII values; nullifier hash + txHash only).
- **Env:** `NEXT_PUBLIC_EXPLORER_BASE` is the only public client config consumed here (e.g. `https://stellar.expert/explorer/testnet`). No secret carries `NEXT_PUBLIC_`. `ISSUER_SECRET` (claimable-balance signer / flag invoker) is server-only. New env vars go in `.env.example` **and** `src/lib/env.ts`.
- **Brand:** one foil-stamp CTA per view; match `BRAND.md` tokens exactly; respect `prefers-reduced-motion`. Voice is scholarly, precise, lightly ceremonial; errors are plain (no apology theatre).
- **Sybil block (AGENT.md §5):** duplicate nullifier reverts (`NullifierUsed`) — that revert **is** the Sybil block; surface it cleanly in the UI as `NULLIFIER_USED`.

### Cross-Phase Interfaces this phase relies on (from the index — use these EXACT names)

```ts
// packages/zk-shared (Phase 1)
type FieldHex = string & { readonly __brand: "FieldHex" };

// src/server/verification.service.ts (Phase 5)
verifyAndRegister(bundle: ProofBundle): Promise<VerifyResult>;
type VerifyResult = { ok: boolean; result: VerificationResult; txHash?: string; explorerUrl?: string };
// VerificationResult enum mirrors Prisma: VERIFIED | INVALID_PROOF | UNKNOWN_ROOT | NULLIFIER_USED | ERROR

// src/server/jobgate.service.ts (THIS phase — produce exactly this signature)
claimGate(slug: string, nullifierHex: FieldHex, boundAddress: string, txHash: string): Promise<{ txHash?: string; rewardType: string }>;

// src/lib/stellar.ts (Phase 3) — publishRoot already exists; this phase adds the two reward helpers below.
```

### File Structure for this phase

- `apps/web/src/server/verification-read.service.ts` — read-side queries for the result page + Sybil mirror lookup (no chain writes).
- `apps/web/src/server/jobgate.service.ts` — `claimGate` + gate list/detail read queries.
- `apps/web/src/lib/stellar.ts` — extend with `issueClaimableBalance(boundAddress, asset)` and `setVerifiedFlag(boundAddress)`.
- `apps/web/src/lib/explorer.ts` — `explorerTxUrl(txHash)` helper from `NEXT_PUBLIC_EXPLORER_BASE`.
- `apps/web/src/app/verify/result/[txHash]/page.tsx` — explorer reveal panel (reveal #1 + #2 states).
- `apps/web/src/app/jobs/page.tsx` — board list.
- `apps/web/src/app/jobs/[slug]/page.tsx` — gate detail + claim CTA.
- `apps/web/src/app/jobs/[slug]/ClaimPanel.tsx` — client component (prove deep-link + claim submit + Sybil-retry surface).
- `apps/web/src/app/api/jobboard/gates/route.ts` — `GET` list.
- `apps/web/src/app/api/jobboard/gates/[slug]/route.ts` — `GET` detail.
- `apps/web/src/app/api/jobboard/gates/[slug]/claim/route.ts` — `POST` claim.
- `apps/web/src/app/page.tsx` — landing three-reveal narrative.
- `apps/web/src/components/ExplorerRevealPanel.tsx`, `RevealNarrative.tsx`, `GateCard.tsx` — brand components.
- Tests under `apps/web/src/**/__tests__/`.

---

### Task 1: Explorer URL helper + env wiring

**Files:**
- Create: `apps/web/src/lib/explorer.ts`
- Modify: `apps/web/src/lib/env.ts` (add `NEXT_PUBLIC_EXPLORER_BASE`)
- Modify: `apps/web/.env.example`
- Test: `apps/web/src/lib/__tests__/explorer.test.ts`

**Interfaces:**
- Consumes: `env` from `src/lib/env.ts` (typed Zod-parsed config object, exists from Phase 0/3).
- Produces: `explorerTxUrl(txHash: string): string` — `NEXT_PUBLIC_EXPLORER_BASE` joined to `/tx/<txHash>`, trailing-slash-safe.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/__tests__/explorer.test.ts
import { describe, expect, it, vi } from "vitest";

vi.mock("../env", () => ({
  env: { NEXT_PUBLIC_EXPLORER_BASE: "https://stellar.expert/explorer/testnet" },
}));

import { explorerTxUrl } from "../explorer";

describe("explorerTxUrl", () => {
  it("joins base and tx hash without double slashes", () => {
    expect(explorerTxUrl("abc123")).toBe(
      "https://stellar.expert/explorer/testnet/tx/abc123",
    );
  });

  it("tolerates a trailing slash on the base", async () => {
    vi.resetModules();
    vi.doMock("../env", () => ({
      env: { NEXT_PUBLIC_EXPLORER_BASE: "https://stellar.expert/explorer/testnet/" },
    }));
    const mod = await import("../explorer");
    expect(mod.explorerTxUrl("abc123")).toBe(
      "https://stellar.expert/explorer/testnet/tx/abc123",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test src/lib/__tests__/explorer.test.ts`
Expected: FAIL — `Cannot find module '../explorer'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/lib/explorer.ts
import { env } from "./env";

/** Build a Stellar testnet explorer URL for a transaction hash. */
export function explorerTxUrl(txHash: string): string {
  const base = env.NEXT_PUBLIC_EXPLORER_BASE.replace(/\/+$/, "");
  return `${base}/tx/${txHash}`;
}
```

Add the key to the Zod env schema in `apps/web/src/lib/env.ts` (inside the existing `z.object({ ... })` passed to the parser):

```ts
  NEXT_PUBLIC_EXPLORER_BASE: z.string().url(),
```

Add to `apps/web/.env.example` under the public section:

```bash
# Public client config (non-secret)
NEXT_PUBLIC_EXPLORER_BASE=https://stellar.expert/explorer/testnet
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test src/lib/__tests__/explorer.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/explorer.ts apps/web/src/lib/__tests__/explorer.test.ts apps/web/src/lib/env.ts apps/web/.env.example
git commit -m "feat(web): add explorer tx URL helper and NEXT_PUBLIC_EXPLORER_BASE env"
```

---

### Task 2: Verification read service (result page + Sybil mirror lookup)

**Files:**
- Create: `apps/web/src/server/verification-read.service.ts`
- Test: `apps/web/src/server/__tests__/verification-read.service.test.ts`

**Interfaces:**
- Consumes: Prisma `Verification` / `Nullifier` models (`SPEC.md §9`); `prisma` from `src/lib/db.ts`; `explorerTxUrl` from Task 1; `AppError` from `src/lib/errors.ts` (Phase 3).
- Produces:
  - `getVerificationByTxHash(txHash: string): Promise<VerificationView | null>`
  - `type VerificationView = { txHash: string; result: VerificationResult; nullifierHex: string; boundAddress: string; disclosed: unknown; explorerUrl: string; createdAt: Date; jobGateSlug: string | null }`

  This is the **read** counterpart to Phase 5's `verifyAndRegister`; it never touches the chain.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/server/__tests__/verification-read.service.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.fn();
vi.mock("../../lib/db", () => ({ prisma: { verification: { findFirst } } }));
vi.mock("../../lib/explorer", () => ({
  explorerTxUrl: (h: string) => `https://explorer.test/tx/${h}`,
}));

import { getVerificationByTxHash } from "../verification-read.service";

beforeEach(() => findFirst.mockReset());

describe("getVerificationByTxHash", () => {
  it("returns null when no row matches", async () => {
    findFirst.mockResolvedValue(null);
    expect(await getVerificationByTxHash("nope")).toBeNull();
  });

  it("maps a VERIFIED row to a view with an explorer URL and no PII", async () => {
    findFirst.mockResolvedValue({
      txHash: "tx1",
      result: "VERIFIED",
      nullifierHex: "0xnull",
      boundAddress: "GABC",
      disclosed: { track: "Data Engineering" },
      createdAt: new Date("2026-06-23T00:00:00Z"),
      jobGate: { slug: "data-engineering" },
    });
    const view = await getVerificationByTxHash("tx1");
    expect(view).toEqual({
      txHash: "tx1",
      result: "VERIFIED",
      nullifierHex: "0xnull",
      boundAddress: "GABC",
      disclosed: { track: "Data Engineering" },
      explorerUrl: "https://explorer.test/tx/tx1",
      createdAt: new Date("2026-06-23T00:00:00Z"),
      jobGateSlug: "data-engineering",
    });
    // disclosed carries only the predicate target; never name/grade/email.
    expect(Object.keys(view!.disclosed as object)).toEqual(["track"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test src/server/__tests__/verification-read.service.test.ts`
Expected: FAIL — `Cannot find module '../verification-read.service'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/server/verification-read.service.ts
import "server-only";
import type { VerificationResult } from "@prisma/client";
import { prisma } from "../lib/db";
import { explorerTxUrl } from "../lib/explorer";

export type VerificationView = {
  txHash: string;
  result: VerificationResult;
  nullifierHex: string;
  boundAddress: string;
  disclosed: unknown;
  explorerUrl: string;
  createdAt: Date;
  jobGateSlug: string | null;
};

/** Read-only lookup for the /verify/result/[txHash] reveal panel. Never touches the chain. */
export async function getVerificationByTxHash(
  txHash: string,
): Promise<VerificationView | null> {
  const row = await prisma.verification.findFirst({
    where: { txHash },
    orderBy: { createdAt: "desc" },
    select: {
      txHash: true,
      result: true,
      nullifierHex: true,
      boundAddress: true,
      disclosed: true,
      createdAt: true,
      jobGate: { select: { slug: true } },
    },
  });
  if (!row || row.txHash === null) return null;
  return {
    txHash: row.txHash,
    result: row.result,
    nullifierHex: row.nullifierHex,
    boundAddress: row.boundAddress,
    disclosed: row.disclosed,
    explorerUrl: explorerTxUrl(row.txHash),
    createdAt: row.createdAt,
    jobGateSlug: row.jobGate?.slug ?? null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test src/server/__tests__/verification-read.service.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/verification-read.service.ts apps/web/src/server/__tests__/verification-read.service.test.ts
git commit -m "feat(web): add read-only verification lookup for result page"
```

---

### Task 3: ExplorerRevealPanel component (reveal #1 + #2 states)

**Files:**
- Create: `apps/web/src/components/ExplorerRevealPanel.tsx`
- Test: `apps/web/src/components/__tests__/ExplorerRevealPanel.test.tsx`

**Interfaces:**
- Consumes: `VerificationView` from Task 2 (passed as props from the page server component).
- Produces: `ExplorerRevealPanel({ view }: { view: VerificationView })` — renders the success state (nullifier + proof on-chain, "nothing personal" copy, foil-stamp explorer link) or the Sybil-rejection state when `view.result === "NULLIFIER_USED"`.

This is a pure presentational client component (no data fetching). Test with `@testing-library/react` (already configured in Phase 3's vitest setup with `jsdom`).

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/__tests__/ExplorerRevealPanel.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExplorerRevealPanel } from "../ExplorerRevealPanel";
import type { VerificationView } from "../../server/verification-read.service";

const base: VerificationView = {
  txHash: "tx1",
  result: "VERIFIED",
  nullifierHex: "0xdeadbeef",
  boundAddress: "GABC...XYZ",
  disclosed: { track: "Data Engineering" },
  explorerUrl: "https://explorer.test/tx/tx1",
  createdAt: new Date("2026-06-23T00:00:00Z"),
  jobGateSlug: null,
};

describe("ExplorerRevealPanel", () => {
  it("shows the verified state with explorer link and nothing-personal copy", () => {
    render(<ExplorerRevealPanel view={base} />);
    expect(screen.getByText(/nothing personal is recorded on-chain/i)).toBeInTheDocument();
    expect(screen.getByText("0xdeadbeef")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /view on the stellar explorer/i });
    expect(link).toHaveAttribute("href", "https://explorer.test/tx/tx1");
    // The on-chain payload must NOT surface any personal attribute.
    expect(screen.queryByText(/grade/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/learner name/i)).not.toBeInTheDocument();
  });

  it("shows the Sybil-rejection state for NULLIFIER_USED", () => {
    render(<ExplorerRevealPanel view={{ ...base, result: "NULLIFIER_USED" }} />);
    expect(screen.getByText(/already been used/i)).toBeInTheDocument();
    expect(screen.getByText(/sybil block/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /view on the stellar explorer/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test src/components/__tests__/ExplorerRevealPanel.test.tsx`
Expected: FAIL — `Cannot find module '../ExplorerRevealPanel'`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/src/components/ExplorerRevealPanel.tsx
import type { VerificationView } from "../server/verification-read.service";

const PERSONAL_FIELDS = ["learner name", "name", "grade", "email", "course"];

export function ExplorerRevealPanel({ view }: { view: VerificationView }) {
  if (view.result === "NULLIFIER_USED") {
    return (
      <section className="border border-error-container bg-error-container/40 rounded-lg p-stack-lg">
        <p className="font-label text-label-md uppercase text-error">Sybil Block</p>
        <h2 className="font-display text-headline-md text-on-background mt-stack-sm">
          This credential has already been used
        </h2>
        <p className="font-body text-body-md text-on-surface-variant mt-stack-md">
          The nullifier for this proof was already recorded on-chain. A second proof from the
          same credential is rejected by the registry contract — this rejection{" "}
          <em>is</em> the Sybil block. One credential, one registration.
        </p>
        <dl className="mt-stack-md font-mono text-caption text-on-surface-variant">
          <dt className="font-label uppercase">Nullifier</dt>
          <dd>{view.nullifierHex}</dd>
        </dl>
      </section>
    );
  }

  return (
    <section className="border border-outline-variant bg-surface-container-lowest rounded-lg p-stack-lg manuscript-glow">
      <p className="font-label text-label-md uppercase text-primary">Verified · On-Chain</p>
      <h2 className="font-display text-headline-md text-on-background mt-stack-sm">
        Nothing personal is recorded on-chain
      </h2>
      <p className="font-body text-body-md text-on-surface-variant mt-stack-md">
        This transaction&rsquo;s payload contains only a zero-knowledge proof and a nullifier
        hash. No name, no grade, no email — none of the credential&rsquo;s attributes appear on
        the ledger. Inspect it yourself on the public explorer.
      </p>

      <dl className="mt-stack-md grid gap-stack-sm font-mono text-caption text-on-surface-variant">
        <div>
          <dt className="font-label uppercase text-secondary">Nullifier Hash</dt>
          <dd className="break-all">{view.nullifierHex}</dd>
        </div>
        <div>
          <dt className="font-label uppercase text-secondary">Bound Address</dt>
          <dd className="break-all">{view.boundAddress}</dd>
        </div>
        <div>
          <dt className="font-label uppercase text-secondary">Transaction</dt>
          <dd className="break-all">{view.txHash}</dd>
        </div>
      </dl>

      <a
        href={view.explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="foil-stamp inline-flex items-center mt-stack-lg rounded px-stack-md py-3 font-label text-label-md uppercase text-on-primary hover:-translate-y-px transition-transform"
      >
        View on the Stellar Explorer
      </a>

      <p className="sr-only">
        On-chain payload excludes: {PERSONAL_FIELDS.join(", ")}.
      </p>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test src/components/__tests__/ExplorerRevealPanel.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ExplorerRevealPanel.tsx apps/web/src/components/__tests__/ExplorerRevealPanel.test.tsx
git commit -m "feat(web): add explorer reveal panel (verified + Sybil states)"
```

---

### Task 4: `/verify/result/[txHash]` page

**Files:**
- Create: `apps/web/src/app/verify/result/[txHash]/page.tsx`
- Create: `apps/web/src/app/verify/result/[txHash]/not-found.tsx`
- Test: `apps/web/src/app/verify/result/[txHash]/__tests__/page.test.tsx`

**Interfaces:**
- Consumes: `getVerificationByTxHash` (Task 2), `ExplorerRevealPanel` (Task 3).
- Produces: a Next.js 16 async Server Component default-exporting `VerifyResultPage`. `params` is a `Promise` (Next 16 / `AGENT.md §8`) — await it.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/app/verify/result/[txHash]/__tests__/page.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const getVerificationByTxHash = vi.fn();
vi.mock("../../../../../server/verification-read.service", () => ({ getVerificationByTxHash }));
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({ notFound }));

import VerifyResultPage from "../page";

describe("VerifyResultPage", () => {
  it("calls notFound when there is no verification row", async () => {
    getVerificationByTxHash.mockResolvedValue(null);
    await expect(
      VerifyResultPage({ params: Promise.resolve({ txHash: "missing" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("renders the reveal panel for an existing verification", async () => {
    getVerificationByTxHash.mockResolvedValue({
      txHash: "tx1",
      result: "VERIFIED",
      nullifierHex: "0xnull",
      boundAddress: "GABC",
      disclosed: { track: "Data Engineering" },
      explorerUrl: "https://explorer.test/tx/tx1",
      createdAt: new Date("2026-06-23T00:00:00Z"),
      jobGateSlug: null,
    });
    const ui = await VerifyResultPage({ params: Promise.resolve({ txHash: "tx1" }) });
    render(ui);
    expect(screen.getByText(/nothing personal is recorded on-chain/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test src/app/verify/result/`
Expected: FAIL — `Cannot find module '../page'`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/src/app/verify/result/[txHash]/page.tsx
import { notFound } from "next/navigation";
import { ExplorerRevealPanel } from "../../../../components/ExplorerRevealPanel";
import { getVerificationByTxHash } from "../../../../server/verification-read.service";

export default async function VerifyResultPage({
  params,
}: {
  params: Promise<{ txHash: string }>;
}) {
  const { txHash } = await params;
  const view = await getVerificationByTxHash(txHash);
  if (!view) notFound();

  return (
    <main className="mx-auto max-w-[1120px] px-margin-mobile py-stack-lg md:px-margin-page">
      <p className="font-label text-label-md uppercase text-secondary">Verification Record</p>
      <h1 className="font-display text-display-lg text-on-background mt-stack-sm">
        Sealed &amp; Attested
      </h1>
      <p className="font-body text-body-md italic text-on-surface-variant mt-stack-sm">
        Cryptographically sealed via the Zelyo Protocol.
      </p>
      <div className="mt-stack-lg">
        <ExplorerRevealPanel view={view} />
      </div>
    </main>
  );
}
```

```tsx
// apps/web/src/app/verify/result/[txHash]/not-found.tsx
export default function NotFound() {
  return (
    <main className="mx-auto max-w-[1120px] px-margin-mobile py-stack-lg md:px-margin-page">
      <p className="font-label text-label-md uppercase text-secondary">Verification Record</p>
      <h1 className="font-display text-headline-md text-on-background mt-stack-sm">
        No record for this transaction
      </h1>
      <p className="font-body text-body-md text-on-surface-variant mt-stack-md">
        We have no verification mirrored for that hash. It may not have been submitted, or the
        transaction is still settling.
      </p>
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test src/app/verify/result/`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/verify/result/
git commit -m "feat(web): add /verify/result/[txHash] explorer reveal page"
```

---

### Task 5: Stellar reward helpers (claimable balance + verified flag)

**Files:**
- Modify: `apps/web/src/lib/stellar.ts` (add two exports + a typed reward-config schema)
- Test: `apps/web/src/lib/__tests__/stellar-rewards.test.ts`

**Interfaces:**
- Consumes: `@stellar/stellar-sdk` 16 (Horizon `Server`, `Operation.createClaimableBalance`, `Claimant`, `Asset`, `TransactionBuilder`, `Keypair`), `env` (`ISSUER_SECRET`, `HORIZON_URL`, `NETWORK_PASSPHRASE`, `SOROBAN_RPC_URL`, `CREDENTIAL_REGISTRY_CONTRACT_ID`), `AppError`.
- Produces:
  - `issueClaimableBalance(boundAddress: string, asset: { code: string; issuer: string; amount: string }): Promise<{ txHash: string }>`
  - `setVerifiedFlag(boundAddress: string): Promise<{ txHash: string }>` — invokes registry contract `set_verified(address, true)` signed by `ISSUER_SECRET`.

  Both sign server-side with `ISSUER_SECRET` (never bundled). The test mocks the SDK so no network call happens.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/__tests__/stellar-rewards.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const submitTransaction = vi.fn();
const loadAccount = vi.fn();
const createClaimableBalance = vi.fn(() => ({ __op: "cb" }));

vi.mock("@stellar/stellar-sdk", () => {
  class Server {
    loadAccount = loadAccount;
    submitTransaction = submitTransaction;
  }
  return {
    Horizon: { Server },
    Asset: class { constructor(public code: string, public issuer: string) {} },
    Claimant: class {
      static predicateUnconditional() { return { __pred: true }; }
      constructor(public destination: string, public predicate: unknown) {}
    },
    Operation: { createClaimableBalance },
    Keypair: { fromSecret: () => ({ publicKey: () => "GISSUER" }) },
    TransactionBuilder: class {
      addOperation() { return this; }
      setTimeout() { return this; }
      build() { return { sign: vi.fn(), hash: () => Buffer.from("hh") }; }
    },
    BASE_FEE: "100",
    Networks: { TESTNET: "Test SDF Network ; September 2015" },
  };
});

vi.mock("../env", () => ({
  env: {
    ISSUER_SECRET: "SAAA",
    HORIZON_URL: "https://horizon.test",
    NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
    SOROBAN_RPC_URL: "https://rpc.test",
    CREDENTIAL_REGISTRY_CONTRACT_ID: "CCCC",
  },
}));

import { issueClaimableBalance } from "../stellar";

beforeEach(() => {
  submitTransaction.mockReset();
  loadAccount.mockReset();
  createClaimableBalance.mockClear();
});

describe("issueClaimableBalance", () => {
  it("builds a createClaimableBalance op to boundAddress and returns the tx hash", async () => {
    loadAccount.mockResolvedValue({ accountId: () => "GISSUER" });
    submitTransaction.mockResolvedValue({ hash: "TXHASH123" });
    const res = await issueClaimableBalance("GHOLDER", {
      code: "ZELYO",
      issuer: "GISSUER",
      amount: "1",
    });
    expect(createClaimableBalance).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ txHash: "TXHASH123" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test src/lib/__tests__/stellar-rewards.test.ts`
Expected: FAIL — `issueClaimableBalance` is not exported from `../stellar`.

- [ ] **Step 3: Write minimal implementation**

Append to `apps/web/src/lib/stellar.ts` (it already imports the SDK + `env` for Phase 3's `publishRoot`; reuse those imports — do not duplicate):

```ts
import {
  Asset,
  Claimant,
  Contract,
  Horizon,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  BASE_FEE,
  rpc,
  nativeToScVal,
  Address,
} from "@stellar/stellar-sdk";

/** Issue a testnet claimable balance of `asset` claimable by `boundAddress`. Signed by ISSUER_SECRET. */
export async function issueClaimableBalance(
  boundAddress: string,
  asset: { code: string; issuer: string; amount: string },
): Promise<{ txHash: string }> {
  const issuerKp = Keypair.fromSecret(env.ISSUER_SECRET);
  const server = new Horizon.Server(env.HORIZON_URL);
  const source = await server.loadAccount(issuerKp.publicKey());
  const claimant = new Claimant(boundAddress, Claimant.predicateUnconditional());
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: env.NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.createClaimableBalance({
        asset: new Asset(asset.code, asset.issuer),
        amount: asset.amount,
        claimants: [claimant],
      }),
    )
    .setTimeout(60)
    .build();
  tx.sign(issuerKp);
  const res = await server.submitTransaction(tx);
  return { txHash: res.hash };
}

/** Flip is_verified(address)=true on the registry contract. Signed by ISSUER_SECRET. */
export async function setVerifiedFlag(boundAddress: string): Promise<{ txHash: string }> {
  const issuerKp = Keypair.fromSecret(env.ISSUER_SECRET);
  const server = new rpc.Server(env.SOROBAN_RPC_URL);
  const source = await server.getAccount(issuerKp.publicKey());
  const contract = new Contract(env.CREDENTIAL_REGISTRY_CONTRACT_ID);
  const built = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: env.NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "set_verified",
        new Address(boundAddress).toScVal(),
        nativeToScVal(true, { type: "bool" }),
      ),
    )
    .setTimeout(60)
    .build();
  const prepared = await server.prepareTransaction(built);
  prepared.sign(issuerKp);
  const sent = await server.sendTransaction(prepared);
  return { txHash: sent.hash };
}
```

> If Phase 3's `stellar.ts` already imports some of these symbols, merge — keep a single import statement. `Networks` is unused here only if `NETWORK_PASSPHRASE` is taken from env; the test references `Networks.TESTNET` but the impl uses `env.NETWORK_PASSPHRASE`, so drop `Networks` from the import if lint flags it.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test src/lib/__tests__/stellar-rewards.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/stellar.ts apps/web/src/lib/__tests__/stellar-rewards.test.ts
git commit -m "feat(web): add Stellar reward helpers (claimable balance + verified flag)"
```

---

### Task 6: `jobgate.service.ts` — gate reads + `claimGate` (both reward types)

**Files:**
- Create: `apps/web/src/server/jobgate.service.ts`
- Test: `apps/web/src/server/__tests__/jobgate.service.test.ts`

**Interfaces:**
- Consumes: `prisma` (`JobGate`, `Verification`, `GateClaim`); `FieldHex` from `@zelyo/zk-shared`; `issueClaimableBalance` / `setVerifiedFlag` (Task 5); `AppError`.
- Produces (EXACT contract from the index):
  - `claimGate(slug: string, nullifierHex: FieldHex, boundAddress: string, txHash: string): Promise<{ txHash?: string; rewardType: string }>`
  - `listGates(): Promise<GateSummary[]>` and `getGate(slug: string): Promise<GateDetail | null>` (read helpers for the board pages/APIs).
  - `type GateSummary = { slug: string; title: string; description: string; requiredPredicate: { attribute: string; equals: string }; rewardType: string }`
  - `type GateDetail = GateSummary & { id: string }`

`claimGate` semantics (per `SPEC.md §7.3`):
1. Load the gate by `slug` (404 → `AppError("GATE_NOT_FOUND", 404, ...)`).
2. Require a `VERIFIED` `Verification` row whose `txHash` + `nullifierHex` + `boundAddress` match the args AND whose `disclosed.track` equals the gate's `requiredPredicate.equals` (predicate satisfied). Otherwise `AppError("PROOF_NOT_ELIGIBLE", 422, ...)`.
3. Enforce idempotency via the `@@unique([jobGateId, nullifierHex])` on `GateClaim` — if a claim already exists, return it (no double-issue).
4. Dispatch by `rewardType`: `CLAIMABLE_BALANCE` → `issueClaimableBalance(boundAddress, rewardConfig.asset)`; `FLAG` → `setVerifiedFlag(boundAddress)`. Persist `GateClaim{ jobGateId, nullifierHex, boundAddress, txHash }`. Return `{ txHash, rewardType }`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/server/__tests__/jobgate.service.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const gateFindUnique = vi.fn();
const verificationFindFirst = vi.fn();
const claimFindUnique = vi.fn();
const claimCreate = vi.fn();
const issueClaimableBalance = vi.fn();
const setVerifiedFlag = vi.fn();

vi.mock("../../lib/db", () => ({
  prisma: {
    jobGate: { findUnique: gateFindUnique },
    verification: { findFirst: verificationFindFirst },
    gateClaim: { findUnique: claimFindUnique, create: claimCreate },
  },
}));
vi.mock("../../lib/stellar", () => ({ issueClaimableBalance, setVerifiedFlag }));

import { claimGate } from "../jobgate.service";
import type { FieldHex } from "@zelyo/zk-shared";

const NULL = "0xnull" as FieldHex;

const gate = (rewardType: string) => ({
  id: "g1",
  slug: "data-engineering",
  rewardType,
  requiredPredicate: { attribute: "track", equals: "Data Engineering" },
  rewardConfig: { asset: { code: "ZELYO", issuer: "GISSUER", amount: "1" } },
});

const verified = {
  result: "VERIFIED",
  txHash: "tx1",
  nullifierHex: "0xnull",
  boundAddress: "GHOLDER",
  disclosed: { track: "Data Engineering" },
};

beforeEach(() => {
  for (const m of [gateFindUnique, verificationFindFirst, claimFindUnique, claimCreate, issueClaimableBalance, setVerifiedFlag]) m.mockReset();
});

describe("claimGate", () => {
  it("issues a claimable balance for a CLAIMABLE_BALANCE gate", async () => {
    gateFindUnique.mockResolvedValue(gate("CLAIMABLE_BALANCE"));
    verificationFindFirst.mockResolvedValue(verified);
    claimFindUnique.mockResolvedValue(null);
    issueClaimableBalance.mockResolvedValue({ txHash: "CBTX" });
    claimCreate.mockResolvedValue({});

    const res = await claimGate("data-engineering", NULL, "GHOLDER", "tx1");

    expect(issueClaimableBalance).toHaveBeenCalledWith("GHOLDER", {
      code: "ZELYO",
      issuer: "GISSUER",
      amount: "1",
    });
    expect(setVerifiedFlag).not.toHaveBeenCalled();
    expect(claimCreate).toHaveBeenCalledWith({
      data: { jobGateId: "g1", nullifierHex: "0xnull", boundAddress: "GHOLDER", txHash: "CBTX" },
    });
    expect(res).toEqual({ txHash: "CBTX", rewardType: "CLAIMABLE_BALANCE" });
  });

  it("flips the verified flag for a FLAG gate", async () => {
    gateFindUnique.mockResolvedValue(gate("FLAG"));
    verificationFindFirst.mockResolvedValue(verified);
    claimFindUnique.mockResolvedValue(null);
    setVerifiedFlag.mockResolvedValue({ txHash: "FLAGTX" });
    claimCreate.mockResolvedValue({});

    const res = await claimGate("data-engineering", NULL, "GHOLDER", "tx1");

    expect(setVerifiedFlag).toHaveBeenCalledWith("GHOLDER");
    expect(issueClaimableBalance).not.toHaveBeenCalled();
    expect(res).toEqual({ txHash: "FLAGTX", rewardType: "FLAG" });
  });

  it("is idempotent: returns the existing claim without re-issuing", async () => {
    gateFindUnique.mockResolvedValue(gate("CLAIMABLE_BALANCE"));
    verificationFindFirst.mockResolvedValue(verified);
    claimFindUnique.mockResolvedValue({ txHash: "OLDTX" });

    const res = await claimGate("data-engineering", NULL, "GHOLDER", "tx1");

    expect(issueClaimableBalance).not.toHaveBeenCalled();
    expect(claimCreate).not.toHaveBeenCalled();
    expect(res).toEqual({ txHash: "OLDTX", rewardType: "CLAIMABLE_BALANCE" });
  });

  it("rejects an unknown gate", async () => {
    gateFindUnique.mockResolvedValue(null);
    await expect(claimGate("nope", NULL, "GHOLDER", "tx1")).rejects.toMatchObject({
      code: "GATE_NOT_FOUND",
    });
  });

  it("rejects when no eligible VERIFIED proof matches the predicate", async () => {
    gateFindUnique.mockResolvedValue(gate("CLAIMABLE_BALANCE"));
    verificationFindFirst.mockResolvedValue(null);
    await expect(claimGate("data-engineering", NULL, "GHOLDER", "tx1")).rejects.toMatchObject({
      code: "PROOF_NOT_ELIGIBLE",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test src/server/__tests__/jobgate.service.test.ts`
Expected: FAIL — `Cannot find module '../jobgate.service'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/server/jobgate.service.ts
import "server-only";
import { z } from "zod";
import type { FieldHex } from "@zelyo/zk-shared";
import { prisma } from "../lib/db";
import { issueClaimableBalance, setVerifiedFlag } from "../lib/stellar";
import { AppError } from "../lib/errors";

const predicateSchema = z.object({ attribute: z.string(), equals: z.string() });
const assetSchema = z.object({ code: z.string(), issuer: z.string(), amount: z.string() });
const rewardConfigSchema = z.object({ asset: assetSchema }).partial({ asset: true });
const disclosedSchema = z.object({ track: z.string() }).passthrough();

export type GateSummary = {
  slug: string;
  title: string;
  description: string;
  requiredPredicate: z.infer<typeof predicateSchema>;
  rewardType: string;
};
export type GateDetail = GateSummary & { id: string };

export async function listGates(): Promise<GateSummary[]> {
  const gates = await prisma.jobGate.findMany({ orderBy: { createdAt: "asc" } });
  return gates.map((g) => ({
    slug: g.slug,
    title: g.title,
    description: g.description,
    requiredPredicate: predicateSchema.parse(g.requiredPredicate),
    rewardType: g.rewardType,
  }));
}

export async function getGate(slug: string): Promise<GateDetail | null> {
  const g = await prisma.jobGate.findUnique({ where: { slug } });
  if (!g) return null;
  return {
    id: g.id,
    slug: g.slug,
    title: g.title,
    description: g.description,
    requiredPredicate: predicateSchema.parse(g.requiredPredicate),
    rewardType: g.rewardType,
  };
}

/** SPEC §7.3: on a valid VERIFIED proof satisfying the gate predicate, issue the reward and record a GateClaim. */
export async function claimGate(
  slug: string,
  nullifierHex: FieldHex,
  boundAddress: string,
  txHash: string,
): Promise<{ txHash?: string; rewardType: string }> {
  const gate = await prisma.jobGate.findUnique({ where: { slug } });
  if (!gate) throw new AppError("GATE_NOT_FOUND", 404, "No such job gate.");

  const predicate = predicateSchema.parse(gate.requiredPredicate);

  const verification = await prisma.verification.findFirst({
    where: { txHash, nullifierHex, boundAddress, result: "VERIFIED" },
    orderBy: { createdAt: "desc" },
  });
  if (!verification) {
    throw new AppError("PROOF_NOT_ELIGIBLE", 422, "No eligible verified proof for this gate.");
  }
  const disclosed = disclosedSchema.safeParse(verification.disclosed);
  if (!disclosed.success || disclosed.data[predicate.attribute] !== predicate.equals) {
    throw new AppError("PROOF_NOT_ELIGIBLE", 422, "The proof does not satisfy this gate.");
  }

  // Idempotent per (gate, nullifier) — the chain already blocks Sybil; this blocks double-issue.
  const existing = await prisma.gateClaim.findUnique({
    where: { jobGateId_nullifierHex: { jobGateId: gate.id, nullifierHex } },
  });
  if (existing) return { txHash: existing.txHash ?? undefined, rewardType: gate.rewardType };

  let rewardTxHash: string;
  if (gate.rewardType === "CLAIMABLE_BALANCE") {
    const cfg = rewardConfigSchema.parse(gate.rewardConfig);
    if (!cfg.asset) throw new AppError("GATE_MISCONFIGURED", 500, "Gate reward asset missing.");
    ({ txHash: rewardTxHash } = await issueClaimableBalance(boundAddress, cfg.asset));
  } else if (gate.rewardType === "FLAG") {
    ({ txHash: rewardTxHash } = await setVerifiedFlag(boundAddress));
  } else {
    throw new AppError("GATE_MISCONFIGURED", 500, "Unknown reward type.");
  }

  await prisma.gateClaim.create({
    data: { jobGateId: gate.id, nullifierHex, boundAddress, txHash: rewardTxHash },
  });
  return { txHash: rewardTxHash, rewardType: gate.rewardType };
}
```

> The `findUnique` on the composite key uses Prisma's `jobGateId_nullifierHex` selector generated from `@@unique([jobGateId, nullifierHex])` in `SPEC.md §9`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test src/server/__tests__/jobgate.service.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/jobgate.service.ts apps/web/src/server/__tests__/jobgate.service.test.ts
git commit -m "feat(web): add jobgate.service claimGate + gate read helpers"
```

---

### Task 7: Job board APIs (`GET` gates, `GET` gate, `POST` claim)

**Files:**
- Create: `apps/web/src/app/api/jobboard/gates/route.ts`
- Create: `apps/web/src/app/api/jobboard/gates/[slug]/route.ts`
- Create: `apps/web/src/app/api/jobboard/gates/[slug]/claim/route.ts`
- Test: `apps/web/src/app/api/jobboard/__tests__/routes.test.ts`

**Interfaces:**
- Consumes: `listGates` / `getGate` / `claimGate` (Task 6); `rateLimit` from `src/lib/rate-limit.ts` (Phase 3 — `rateLimit(key, points, durationSec)` throwing `AppError("RATE_LIMITED", 429, ...)` with `Retry-After`); `withErrorBoundary` from `src/lib/errors.ts` (Phase 3 wrapper that maps `AppError` → `{ error: { code, message } }`); `audit(action, { target, ip, meta })` from `src/lib/audit.ts` (Phase 3).
- Produces: three route handlers returning typed JSON. Claim body schema:

```ts
const claimBodySchema = z.object({
  nullifierHex: z.string().regex(/^0x[0-9a-f]{1,64}$/),
  boundAddress: z.string().regex(/^G[A-Z2-7]{55}$/),
  txHash: z.string().min(1).max(128),
});
```

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/app/api/jobboard/__tests__/routes.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const listGates = vi.fn();
const getGate = vi.fn();
const claimGate = vi.fn();
const rateLimit = vi.fn();
const audit = vi.fn();

vi.mock("../../../../server/jobgate.service", () => ({ listGates, getGate, claimGate }));
vi.mock("../../../../lib/rate-limit", () => ({ rateLimit }));
vi.mock("../../../../lib/audit", () => ({ audit }));

import { GET as listRoute } from "../gates/route";
import { GET as detailRoute } from "../gates/[slug]/route";
import { POST as claimRoute } from "../gates/[slug]/claim/route";

beforeEach(() => {
  for (const m of [listGates, getGate, claimGate, rateLimit, audit]) m.mockReset();
  rateLimit.mockResolvedValue(undefined);
});

const claimReq = (body: unknown) =>
  new Request("http://localhost/api/jobboard/gates/data-engineering/claim", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4" },
    body: JSON.stringify(body),
  });

describe("jobboard routes", () => {
  it("GET gates returns the list", async () => {
    listGates.mockResolvedValue([{ slug: "data-engineering", title: "T", description: "D", requiredPredicate: { attribute: "track", equals: "Data Engineering" }, rewardType: "CLAIMABLE_BALANCE" }]);
    const res = await listRoute();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ gates: [{ slug: "data-engineering" }] });
  });

  it("GET gate 404s for unknown slug", async () => {
    getGate.mockResolvedValue(null);
    const res = await detailRoute(new Request("http://localhost"), { params: Promise.resolve({ slug: "nope" }) });
    expect(res.status).toBe(404);
  });

  it("POST claim validates body and calls claimGate, rate-limited", async () => {
    claimGate.mockResolvedValue({ txHash: "CBTX", rewardType: "CLAIMABLE_BALANCE" });
    const body = { nullifierHex: "0xnull", boundAddress: "G" + "A".repeat(55), txHash: "tx1" };
    const res = await claimRoute(claimReq(body), { params: Promise.resolve({ slug: "data-engineering" }) });
    expect(rateLimit).toHaveBeenCalled();
    expect(claimGate).toHaveBeenCalledWith("data-engineering", "0xnull", "G" + "A".repeat(55), "tx1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ txHash: "CBTX", rewardType: "CLAIMABLE_BALANCE" });
    expect(audit).toHaveBeenCalled();
  });

  it("POST claim rejects an invalid body with 400", async () => {
    const res = await claimRoute(claimReq({ nullifierHex: "bad" }), { params: Promise.resolve({ slug: "data-engineering" }) });
    expect(res.status).toBe(400);
    expect(claimGate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test src/app/api/jobboard/`
Expected: FAIL — `Cannot find module '../gates/route'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/app/api/jobboard/gates/route.ts
import { NextResponse } from "next/server";
import { withErrorBoundary } from "../../../../lib/errors";
import { listGates } from "../../../../server/jobgate.service";

export const GET = withErrorBoundary(async () => {
  const gates = await listGates();
  return NextResponse.json({ gates });
});
```

```ts
// apps/web/src/app/api/jobboard/gates/[slug]/route.ts
import { NextResponse } from "next/server";
import { AppError, withErrorBoundary } from "../../../../../lib/errors";
import { getGate } from "../../../../../server/jobgate.service";

export const GET = withErrorBoundary(
  async (_req: Request, ctx: { params: Promise<{ slug: string }> }) => {
    const { slug } = await ctx.params;
    const gate = await getGate(slug);
    if (!gate) throw new AppError("GATE_NOT_FOUND", 404, "No such job gate.");
    return NextResponse.json({ gate });
  },
);
```

```ts
// apps/web/src/app/api/jobboard/gates/[slug]/claim/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import type { FieldHex } from "@zelyo/zk-shared";
import { AppError, withErrorBoundary } from "../../../../../../lib/errors";
import { rateLimit } from "../../../../../../lib/rate-limit";
import { audit } from "../../../../../../lib/audit";
import { claimGate } from "../../../../../../server/jobgate.service";

const claimBodySchema = z.object({
  nullifierHex: z.string().regex(/^0x[0-9a-f]{1,64}$/),
  boundAddress: z.string().regex(/^G[A-Z2-7]{55}$/),
  txHash: z.string().min(1).max(128),
});

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export const POST = withErrorBoundary(
  async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
    const { slug } = await ctx.params;
    const ip = clientIp(req);
    await rateLimit(`jobclaim:${ip}`, 10, 60);

    const json: unknown = await req.json().catch(() => null);
    const parsed = claimBodySchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError("INVALID_BODY", 400, "Invalid claim payload.");
    }
    const { nullifierHex, boundAddress, txHash } = parsed.data;

    try {
      const result = await claimGate(slug, nullifierHex as FieldHex, boundAddress, txHash);
      await audit("jobgate.claim", { target: slug, ip, meta: { nullifierHex, txHash, rewardType: result.rewardType, ok: true } });
      return NextResponse.json(result);
    } catch (err) {
      const code = err instanceof AppError ? err.code : "ERROR";
      await audit("jobgate.claim", { target: slug, ip, meta: { nullifierHex, txHash, ok: false, code } });
      throw err;
    }
  },
);
```

> `withErrorBoundary` (Phase 3) catches `AppError` and returns `{ error: { code, message } }` with the carried `httpStatus`, and attaches `Retry-After` for `RATE_LIMITED`. The handlers stay thin per `AGENT.md §2`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test src/app/api/jobboard/`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/jobboard/
git commit -m "feat(web): add job board APIs (list/detail gates + rate-limited claim)"
```

---

### Task 8: GateCard component + `/jobs` board page

**Files:**
- Create: `apps/web/src/components/GateCard.tsx`
- Create: `apps/web/src/app/jobs/page.tsx`
- Test: `apps/web/src/components/__tests__/GateCard.test.tsx`

**Interfaces:**
- Consumes: `GateSummary` (Task 6), `listGates` (Task 6).
- Produces: `GateCard({ gate }: { gate: GateSummary })`; default-exported async `JobsPage` Server Component.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/__tests__/GateCard.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GateCard } from "../GateCard";

describe("GateCard", () => {
  it("renders title, predicate and a link to the gate detail", () => {
    render(
      <GateCard
        gate={{
          slug: "data-engineering",
          title: "Senior Data Engineer",
          description: "Prove your Data Engineering credential.",
          requiredPredicate: { attribute: "track", equals: "Data Engineering" },
          rewardType: "CLAIMABLE_BALANCE",
        }}
      />,
    );
    expect(screen.getByText("Senior Data Engineer")).toBeInTheDocument();
    expect(screen.getByText(/Data Engineering/)).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/jobs/data-engineering");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test src/components/__tests__/GateCard.test.tsx`
Expected: FAIL — `Cannot find module '../GateCard'`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/src/components/GateCard.tsx
import Link from "next/link";
import type { GateSummary } from "../server/jobgate.service";

export function GateCard({ gate }: { gate: GateSummary }) {
  return (
    <Link
      href={`/jobs/${gate.slug}`}
      className="block border-l border-l-primary border border-outline-variant bg-surface-container-lowest rounded-lg p-stack-md hover:opacity-90 transition-opacity"
    >
      <p className="font-label text-label-md uppercase text-secondary">Registry Gate</p>
      <h3 className="font-headline text-headline-md text-on-background mt-stack-sm">{gate.title}</h3>
      <p className="font-body text-body-md text-on-surface-variant mt-stack-sm">{gate.description}</p>
      <p className="font-mono text-caption text-on-surface-variant mt-stack-md">
        Requires: {gate.requiredPredicate.attribute} == &ldquo;{gate.requiredPredicate.equals}&rdquo;
      </p>
    </Link>
  );
}
```

```tsx
// apps/web/src/app/jobs/page.tsx
import { GateCard } from "../../components/GateCard";
import { listGates } from "../../server/jobgate.service";

export default async function JobsPage() {
  const gates = await listGates();
  return (
    <main className="mx-auto max-w-[1120px] px-margin-mobile py-stack-lg md:px-margin-page">
      <p className="font-label text-label-md uppercase text-secondary">The Public Board</p>
      <h1 className="font-display text-display-lg text-on-background mt-stack-sm">Verified Gates</h1>
      <p className="font-body text-body-md italic text-on-surface-variant mt-stack-sm">
        Each gate opens to a single proven fact — nothing more is disclosed.
      </p>
      <div className="mt-stack-lg grid gap-gutter md:grid-cols-2">
        {gates.map((gate) => (
          <GateCard key={gate.slug} gate={gate} />
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test src/components/__tests__/GateCard.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/GateCard.tsx apps/web/src/app/jobs/page.tsx apps/web/src/components/__tests__/GateCard.test.tsx
git commit -m "feat(web): add /jobs board page and GateCard component"
```

---

### Task 9: ClaimPanel (client) + `/jobs/[slug]` gate detail page

**Files:**
- Create: `apps/web/src/app/jobs/[slug]/ClaimPanel.tsx`
- Create: `apps/web/src/app/jobs/[slug]/page.tsx`
- Test: `apps/web/src/app/jobs/[slug]/__tests__/ClaimPanel.test.tsx`

**Interfaces:**
- Consumes: `getGate` (Task 6) in the page; `GateDetail` type. The page passes the gate + a `proveHref` (deep-link to `/wallet/prove` carrying `?gate=<slug>` so the holder flow knows which predicate to disclose; Phase 5's prove page reads this param).
- Produces:
  - `ClaimPanel({ gate, proveHref }: { gate: GateDetail; proveHref: string })` — `"use client"`. Reads `txHash`, `nullifier`, `address` from the URL query (set after a successful verification redirect from Phase 5). If present, shows a "Claim your reward" foil-stamp button posting to `/api/jobboard/gates/[slug]/claim`; otherwise shows the "Prove with Zelyo" link to `proveHref`. Surfaces a `NULLIFIER_USED`/`PROOF_NOT_ELIGIBLE` error as plain copy.
  - default-exported async `GateDetailPage` Server Component.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/app/jobs/[slug]/__tests__/ClaimPanel.test.tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClaimPanel } from "../ClaimPanel";
import type { GateDetail } from "../../../../server/jobgate.service";

const gate: GateDetail = {
  id: "g1",
  slug: "data-engineering",
  title: "Senior Data Engineer",
  description: "Prove it.",
  requiredPredicate: { attribute: "track", equals: "Data Engineering" },
  rewardType: "CLAIMABLE_BALANCE",
};

function setSearch(qs: string) {
  Object.defineProperty(window, "location", {
    writable: true,
    value: new URL(`http://localhost/jobs/data-engineering${qs}`),
  });
}

afterEach(() => vi.restoreAllMocks());

describe("ClaimPanel", () => {
  it("shows the prove link when no verification is in the URL", () => {
    setSearch("");
    render(<ClaimPanel gate={gate} proveHref="/wallet/prove?gate=data-engineering" />);
    expect(screen.getByRole("link", { name: /prove with zelyo/i })).toHaveAttribute(
      "href",
      "/wallet/prove?gate=data-engineering",
    );
  });

  it("claims when verification params are present and shows the reward tx", async () => {
    setSearch("?txHash=tx1&nullifier=0xnull&address=GHOLDER");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ txHash: "CBTX", rewardType: "CLAIMABLE_BALANCE" }) })),
    );
    render(<ClaimPanel gate={gate} proveHref="/wallet/prove?gate=data-engineering" />);
    fireEvent.click(screen.getByRole("button", { name: /claim your reward/i }));
    await waitFor(() => expect(screen.getByText(/CBTX/)).toBeInTheDocument());
  });

  it("surfaces a NULLIFIER_USED rejection as plain copy", async () => {
    setSearch("?txHash=tx1&nullifier=0xnull&address=GHOLDER");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({ error: { code: "PROOF_NOT_ELIGIBLE", message: "The proof does not satisfy this gate." } }) })),
    );
    render(<ClaimPanel gate={gate} proveHref="/wallet/prove?gate=data-engineering" />);
    fireEvent.click(screen.getByRole("button", { name: /claim your reward/i }));
    await waitFor(() => expect(screen.getByText(/does not satisfy this gate/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test src/app/jobs/`
Expected: FAIL — `Cannot find module '../ClaimPanel'`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/src/app/jobs/[slug]/ClaimPanel.tsx
"use client";

import { useState } from "react";
import type { GateDetail } from "../../../server/jobgate.service";

type ClaimResult = { txHash?: string; rewardType: string };

export function ClaimPanel({ gate, proveHref }: { gate: GateDetail; proveHref: string }) {
  const params = new URL(window.location.href).searchParams;
  const txHash = params.get("txHash");
  const nullifierHex = params.get("nullifier");
  const boundAddress = params.get("address");
  const hasVerification = Boolean(txHash && nullifierHex && boundAddress);

  const [status, setStatus] = useState<"idle" | "claiming" | "done" | "error">("idle");
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function claim() {
    setStatus("claiming");
    setError(null);
    const res = await fetch(`/api/jobboard/gates/${gate.slug}/claim`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nullifierHex, boundAddress, txHash }),
    });
    const json = await res.json();
    if (!res.ok) {
      setStatus("error");
      setError(json?.error?.message ?? "Claim could not be completed.");
      return;
    }
    setResult(json as ClaimResult);
    setStatus("done");
  }

  if (!hasVerification) {
    return (
      <a
        href={proveHref}
        className="foil-stamp inline-flex items-center rounded px-stack-md py-3 font-label text-label-md uppercase text-on-primary hover:-translate-y-px transition-transform"
      >
        Prove with Zelyo
      </a>
    );
  }

  if (status === "done" && result) {
    return (
      <div className="border border-outline-variant bg-surface-container-lowest rounded-lg p-stack-md">
        <p className="font-label text-label-md uppercase text-primary">Reward Unlocked</p>
        <p className="font-body text-body-md text-on-surface-variant mt-stack-sm">
          Your selective-disclosure proof unlocked this gate ({result.rewardType}).
        </p>
        <p className="font-mono text-caption text-on-surface-variant mt-stack-sm break-all">
          {result.txHash}
        </p>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={claim}
        disabled={status === "claiming"}
        className="foil-stamp inline-flex items-center rounded px-stack-md py-3 font-label text-label-md uppercase text-on-primary hover:-translate-y-px transition-transform disabled:opacity-60"
      >
        {status === "claiming" ? "Claiming…" : "Claim Your Reward"}
      </button>
      {error ? (
        <p className="font-body text-body-md text-error mt-stack-sm">{error}</p>
      ) : null}
    </div>
  );
}
```

```tsx
// apps/web/src/app/jobs/[slug]/page.tsx
import { notFound } from "next/navigation";
import { getGate } from "../../../server/jobgate.service";
import { ClaimPanel } from "./ClaimPanel";

export default async function GateDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const gate = await getGate(slug);
  if (!gate) notFound();

  const proveHref = `/wallet/prove?gate=${gate.slug}`;

  return (
    <main className="mx-auto max-w-[1120px] px-margin-mobile py-stack-lg md:px-margin-page">
      <p className="font-label text-label-md uppercase text-secondary">Registry Gate</p>
      <h1 className="font-display text-display-lg text-on-background mt-stack-sm">{gate.title}</h1>
      <p className="font-body text-body-md text-on-surface-variant mt-stack-md max-w-2xl">
        {gate.description}
      </p>
      <p className="font-mono text-caption text-on-surface-variant mt-stack-md">
        This gate discloses only: {gate.requiredPredicate.attribute} ==
        &ldquo;{gate.requiredPredicate.equals}&rdquo;. All other credential data stays private.
      </p>
      <div className="mt-stack-lg">
        <ClaimPanel gate={gate} proveHref={proveHref} />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test src/app/jobs/`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/jobs/\[slug\]/
git commit -m "feat(web): add /jobs/[slug] gate detail + ClaimPanel (prove deep-link + claim)"
```

---

### Task 10: Landing `/` — three-reveal narrative

**Files:**
- Create: `apps/web/src/components/RevealNarrative.tsx`
- Modify: `apps/web/src/app/page.tsx` (replace any Phase 3 placeholder landing)
- Test: `apps/web/src/components/__tests__/RevealNarrative.test.tsx`

**Interfaces:**
- Consumes: nothing dynamic — static narrative content. CTAs link to `/issuer`, `/wallet`, `/jobs`.
- Produces: `RevealNarrative()` — renders the three acceptance reveals (`SPEC.md §13`) as editorial sections; `HomePage` default export composes the hero + narrative + three role CTAs.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/__tests__/RevealNarrative.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RevealNarrative } from "../RevealNarrative";

describe("RevealNarrative", () => {
  it("renders the three reveals", () => {
    render(<RevealNarrative />);
    expect(screen.getByText(/nothing personal on-chain/i)).toBeInTheDocument();
    expect(screen.getByText(/one credential, one registration/i)).toBeInTheDocument();
    expect(screen.getByText(/selective disclosure/i)).toBeInTheDocument();
  });

  it("links to the three roles", () => {
    render(<RevealNarrative />);
    expect(screen.getByRole("link", { name: /issue a credential/i })).toHaveAttribute("href", "/issuer");
    expect(screen.getByRole("link", { name: /open your wallet/i })).toHaveAttribute("href", "/wallet");
    expect(screen.getByRole("link", { name: /browse the gates/i })).toHaveAttribute("href", "/jobs");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test src/components/__tests__/RevealNarrative.test.tsx`
Expected: FAIL — `Cannot find module '../RevealNarrative'`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/src/components/RevealNarrative.tsx
import Link from "next/link";

const REVEALS = [
  {
    eyebrow: "Reveal I",
    title: "Nothing personal on-chain",
    body: "A verification writes only a zero-knowledge proof and a nullifier hash to the ledger. No name, no grade, no email ever touches the chain — inspect any transaction on the public explorer and see for yourself.",
  },
  {
    eyebrow: "Reveal II",
    title: "One credential, one registration",
    body: "The same credential can prove a fact only once per scope. A second proof reuses the nullifier and the registry contract rejects it on-chain. That rejection is the Sybil block — enforced by mathematics, not by trust.",
  },
  {
    eyebrow: "Reveal III",
    title: "Selective disclosure unlocks a claim",
    body: "Disclose a single fact — your track — while name and grade stay sealed. A valid proof against a public gate unlocks a Stellar-native reward bound to your wallet.",
  },
];

export function RevealNarrative() {
  return (
    <div>
      <div className="grid gap-stack-lg">
        {REVEALS.map((r) => (
          <section key={r.eyebrow} className="ledger-line border-l border-l-primary pl-stack-md py-stack-sm">
            <p className="font-label text-label-md uppercase text-secondary">{r.eyebrow}</p>
            <h2 className="font-headline text-headline-md text-on-background mt-stack-sm">{r.title}</h2>
            <p className="font-body text-body-md text-on-surface-variant mt-stack-sm max-w-2xl">{r.body}</p>
          </section>
        ))}
      </div>

      <div className="mt-stack-lg flex flex-wrap gap-stack-md">
        <Link href="/issuer" className="font-label text-label-md uppercase text-primary border-b border-primary pb-1">
          Issue a Credential
        </Link>
        <Link href="/wallet" className="font-label text-label-md uppercase text-primary border-b border-primary pb-1">
          Open Your Wallet
        </Link>
        <Link href="/jobs" className="font-label text-label-md uppercase text-primary border-b border-primary pb-1">
          Browse the Gates
        </Link>
      </div>
    </div>
  );
}
```

```tsx
// apps/web/src/app/page.tsx
import Link from "next/link";
import { RevealNarrative } from "../components/RevealNarrative";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-[1120px] px-margin-mobile py-stack-lg md:px-margin-page">
      <p className="font-label text-label-md uppercase text-secondary">The Zelyo Protocol</p>
      <h1 className="font-display text-display-lg text-on-background mt-stack-sm max-w-3xl">
        Verifiable credentials, sealed with the gravity of a printed record.
      </h1>
      <p className="font-body text-body-lg text-on-surface-variant mt-stack-md max-w-2xl">
        Prove one fact about a credential in zero knowledge. The chain records only a nullifier —
        never who you are.
      </p>

      <div className="mt-stack-lg">
        <Link
          href="/jobs"
          className="foil-stamp inline-flex items-center rounded px-stack-md py-3 font-label text-label-md uppercase text-on-primary hover:-translate-y-px transition-transform"
        >
          See the Reveals
        </Link>
      </div>

      <div className="mt-stack-lg">
        <RevealNarrative />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test src/components/__tests__/RevealNarrative.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/RevealNarrative.tsx apps/web/src/app/page.tsx apps/web/src/components/__tests__/RevealNarrative.test.tsx
git commit -m "feat(web): add landing three-reveal narrative"
```

---

### Task 11: Full phase verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full web suite**

Run: `pnpm --filter web test`
Expected: PASS — all Phase 6 suites green (explorer, verification-read, ExplorerRevealPanel, verify result page, stellar-rewards, jobgate.service, jobboard routes, GateCard, ClaimPanel, RevealNarrative) plus prior phases.

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm --filter web typecheck && pnpm --filter web lint`
Expected: no errors. (If lint flags an unused SDK import in `stellar.ts`, remove it; if `exactOptionalPropertyTypes` flags `existing.txHash ?? undefined`, that is intentional — `GateClaim.txHash` is nullable.)

- [ ] **Step 3: Manual smoke against the stack**

Run: `docker compose up -d && pnpm --filter web dev`
Then verify in a browser:
- `/` shows the three-reveal narrative + one foil-stamp CTA.
- `/jobs` lists the seeded `data-engineering` gate.
- `/jobs/data-engineering` shows the predicate copy and a "Prove with Zelyo" link to `/wallet/prove?gate=data-engineering`.
- `/verify/result/<a real txHash from a Phase 5 verification>` shows the explorer reveal panel with a working `NEXT_PUBLIC_EXPLORER_BASE` link.

- [ ] **Step 4: Commit any fixups**

```bash
git add -A
git commit -m "chore(web): phase 6 verification fixups"
```

---

## Phase Gate (maps to `SPEC.md §13`)

Do not start Phase 7 until all three pass:

- [ ] **(1) Nothing personal on-chain.** A successful verification's `/verify/result/[txHash]` page renders the success state, shows only the nullifier hash + bound address + tx hash, and links to the Stellar testnet explorer via `NEXT_PUBLIC_EXPLORER_BASE`. Inspecting the linked tx shows no name/grade/email/attributes. (Tasks 1–4; `ExplorerRevealPanel` asserts the on-chain payload excludes personal fields.)
- [ ] **(2) Sybil block.** Submitting a second proof with the same nullifier yields a `Verification` row with `result === "NULLIFIER_USED"`; `/verify/result/[txHash]` renders the Sybil-rejection state, and the `ClaimPanel` surfaces the rejection as plain copy. The first submission succeeded and is recorded. (Task 3 Sybil state + Task 9 error surface; the chain enforces via `NullifierUsed`.)
- [ ] **(3) Selective disclosure unlocks a claim.** A holder discloses only `track` (name/grade hidden) and proves against the `data-engineering` gate; `POST /api/jobboard/gates/data-engineering/claim` issues a testnet claimable balance (or flips the verified flag) and records a `GateClaim` unique per `(gate, nullifier)`. A second claim is idempotent (no double-issue). (Tasks 5–9.)
