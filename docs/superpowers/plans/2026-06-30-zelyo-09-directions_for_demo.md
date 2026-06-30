# Phase 9 — Directions for Demo: Gates, Privacy & Platform

> **For agentic workers:** This is a **post-Phase-8 directions document** for hackathon demo preparation. Read the index (`2026-06-23-zelyo-00-index.md`) for Global Constraints and Cross-Phase Interface Contract. This phase is NOT a hardening or feature-completion phase — it is a **creative sprint** to make the ZK privacy story visceral and the platform feel real.

**Goal:** Lean into the ZK privacy story for a hackathon demo. Make "what you reveal vs. what stays private" visually immediate. Add gate creation so the platform feels alive, not pre-seeded.

**Prerequisites:** Phases 0–8 complete — the full spine (mint → prove → verify → claim), the three reveals, Auth.js RBAC, rate limiting, audit, and the `data-engineering` gate all working.

**Gate:** A live demo that an unfamiliar user can walk through in ≤5 minutes: browse a job board with ≥2 gates, create a new gate as issuer, prove for one of them, and claim a reward — with the privacy comparison visible at each step.

---

## Global Constraints

Apply to **every task** (copied verbatim from the index):

- **Privacy is the product.** Personal data (name/grade/attributes) never goes on-chain, in logs, in analytics, or in client bundles. The only on-chain payload is the nullifier hash + proof + root + boundAddress.
- **TypeScript:** `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. No `any`; `unknown` + Zod at boundaries.
- **Route handlers are thin:** validate (Zod) → authorize → call a `src/server/*` service → map to typed response.
- **Errors:** throw typed `AppError(code, httpStatus, publicMessage)`; never leak stack traces or DB errors.
- **RBAC:** ADMIN for `/issuer/**`, HOLDER for `/wallet/**`. Never trust client-sent role.
- **Brand:** one foil-stamp CTA per view; match `BRAND.md` tokens; respect `prefers-reduced-motion`.
- **Definition of done:** builds; `typecheck`, `lint`, relevant tests pass; no secret/PII logged or shipped to client.

---

## Architecture

Gates are the **bridge** between ZK proofs and real-world programmable value. The current system seeds one `data-engineering` gate statically. The directions below extend gates in two axes:

1. **Gate creation** — issuers can create gates at runtime, no re-seed required
2. **Privacy visibility** — the UI makes the selective-disclosure contrast immediate and visceral

The current circuit supports `equals` predicates only (e.g. `track == "Data Engineering"`). The privacy panel direction is the highest-impact/lowest-complexity addition. Gate creation unlocks the platform narrative. Multi-predicate and time-limited gates are higher ceiling but require circuit or contract changes.

---

## Tech Stack

Same as Phase 8. No new packages expected for the privacy panel or basic gate creation. Multi-predicate gates would require circuit recompilation (`circuits/zelyo_credential`).

---

## Cross-Phase Interfaces this phase extends

```ts
// jobgate.service.ts — extended with create/update
// Existing:
claimGate(slug: string, nullifierHex: FieldHex, boundAddress: string, txHash: string): Promise<{ txHash?: string; rewardType: string }>;
listGates(): Promise<GateSummary[]>;
getGate(slug: string): Promise<GateDetail | null>;

// New (this phase):
createGate(input: CreateGateInput): Promise<GateDetail>;
type CreateGateInput = {
  slug: string;
  title: string;
  description: string;
  requiredPredicate: { attribute: string; equals: string };
  rewardType: "CLAIMABLE_BALANCE" | "FLAG";
  rewardConfig: { asset?: { code: string; issuer: string; amount: string } };
};

// verification.service.ts — new utility for privacy panel
// Returns the full disclosure breakdown for UI rendering
getVerificationDisclosure(txHash: string): Promise<{
  disclosed: { attribute: string; value: string }[];
  hidden: { attribute: string; value: string }[];  // plaintext — never sent anywhere, just shown
  onChain: { nullifier: string; root: string; boundAddress: string };
}>;
```

---

## File Structure (new / modified)

- `apps/web/src/server/jobgate.service.ts` — add `createGate`
- `apps/web/src/app/issuer/gates/page.tsx` — gate management UI (create / list)
- `apps/web/src/app/issuer/gates/GateForm.tsx` — create gate form
- `apps/web/src/app/api/issuer/gates/route.ts` — `POST` create gate
- `apps/web/src/app/api/jobboard/gates/[slug]/route.ts` — extend with `PUT`/`DELETE` (optional)
- `apps/web/src/app/jobs/[slug]/PrivacyPanel.tsx` — new: shows "what revealed / what hidden"
- `apps/web/src/app/jobs/[slug]/ClaimPanel.tsx` — incorporate PrivacyPanel
- `apps/web/src/app/verify/result/[txHash]/PrivacyPanel.tsx` — new: privacy breakdown at result page
- Tests for all new routes and components

---

## Direction Table

| Direction | Hackathon Appeal | Complexity |
|-----------|-----------------|------------|
| **Issuer gate creation UI** | Adds narrative: "any issuer can create a gate" — makes it feel like a real platform, not a demo | Medium |
| **Privacy dashboard** | Shows live "what you revealed / what stayed private" comparison at claim time — makes the ZK story visceral | Low |
| **Multi-predicate gates** | "Prove track AND grade ≥ B" — shows the circuit can handle richer logic | Medium-High |
| **Gate marketplace** | Multiple issuers publish gates; holders browse — shows ecosystem | High |
| **Time-limited gates** | Gates that expire — shows on-chain programmability | Medium |

---

---

### Direction 1: Issuer Gate Creation UI

**Files:**
- Modify: `apps/web/src/server/jobgate.service.ts` — add `createGate(input): Promise<GateDetail>`
- Create: `apps/web/src/app/issuer/gates/page.tsx` — Server Component listing gates + create CTA
- Create: `apps/web/src/app/issuer/gates/GateForm.tsx` — `"use client"` form with Zod validation
- Create: `apps/web/src/app/api/issuer/gates/route.ts` — `POST /api/issuer/gates` (ADMIN RBAC)
- Test: `apps/web/src/server/__tests__/jobgate.service.test.ts` — add `createGate` cases
- Test: `apps/web/src/app/issuer/gates/__tests__/GateForm.test.tsx`

**Interfaces:**
- Consumes: `CreateGateInput` (slug, title, description, requiredPredicate, rewardType, rewardConfig); ADMIN session from `auth()`
- Produces: `GateDetail` written to `db.jobGate`; gate immediately appears on `/jobs`

**UX Flow:**
1. Admin navigates to `/issuer/gates`
2. Clicks "Create Gate" → `GateForm` slides in
3. Fills: slug (`data-engineering-2`), title, description, predicate (attribute dropdown: track/grade/name/courseName/date; equals value), reward type (CLAIMABLE_BALANCE or FLAG), reward amount
4. Submits → `POST /api/issuer/gates` → `createGate` writes to DB
5. Gate appears on `/jobs` board immediately (no re-seed)

**Key Constraints:**
- Slug must be unique (DB unique index + Zod)
- Reward config validated by same schema as seed (`asset: { code, issuer, amount }` for CLAIMABLE_BALANCE)
- ADMIN RBAC enforced at route AND service layer
- No on-chain gate registration (keeps it simple; gates are off-chain config)

**Tasks:**

- [ ] **Step 1: Add `createGate` to `jobgate.service.ts`**

```ts
// apps/web/src/server/jobgate.service.ts
export async function createGate(input: CreateGateInput): Promise<GateDetail> {
  const existing = await db.jobGate.findUnique({ where: { slug: input.slug } });
  if (existing) throw new AppError("GATE_SLUG_TAKEN", 409, "Slug already in use.");

  const gate = await db.jobGate.create({ data: input });
  return {
    id: gate.id,
    slug: gate.slug,
    title: gate.title,
    description: gate.description,
    requiredPredicate: predicateSchema.parse(gate.requiredPredicate),
    rewardType: gate.rewardType,
  };
}
```

- [ ] **Step 2: Write failing tests** for `createGate` (happy path; slug conflict; invalid predicate; invalid reward config)

- [ ] **Step 3: Build `GateForm.tsx`** — `"use client"`; attribute dropdown (track/grade/learnerName/courseName/issueDate); reward type toggle; XLM amount input for CLAIMABLE_BALANCE; Zod validation; foil-stamp submit button

- [ ] **Step 4: Build `/issuer/gates/page.tsx`** — Server Component; ADMIN redirect if not auth; lists existing gates; renders `GateForm`; links to `/jobs/[slug]`

- [ ] **Step 5: Build `POST /api/issuer/gates`** — ADMIN RBAC; Zod parse `CreateGateInput`; call `createGate`; return `GateDetail`; audit log

- [ ] **Step 6: Add seed gates for demo** — seed 2–3 additional gates with varied predicates so the job board isn't empty on demo day:
  - `python-development` (track == "Python Development", 5 XLM)
  - `web3-fundamentals` (track == "Web3 Fundamentals", 15 XLM)
  - Or gate by grade: `honors-graduate` (grade == "A", 20 XLM)

- [ ] **Step 7: Typecheck + lint + tests**

---

### Direction 2: Privacy Comparison Panel

**Files:**
- Create: `apps/web/src/app/jobs/[slug]/PrivacyPanel.tsx` — `"use client"`; shows disclosure table
- Create: `apps/web/src/app/verify/result/[txHash]/PrivacyPanel.tsx` — `"use client"`; same component, different placement
- Modify: `apps/web/src/app/jobs/[slug]/ClaimPanel.tsx` — render `PrivacyPanel` alongside claim button
- Modify: `apps/web/src/app/verify/result/[txHash]/page.tsx` — pass disclosed/hidden data to panel
- Test: `apps/web/src/app/jobs/[slug]/__tests__/PrivacyPanel.test.tsx`

**Interfaces:**
- Consumes: `disclosed` (the `{ value, raw }` model from the verification) + credential attributes from the verification record
- Produces: A two-column visual: "What your proof reveals" (green checkmarks) vs. "What stays private" (red locks) — showing attribute names and **plaintext values** for the revealed ones, and `***` or `🔒 hidden` for the rest

**UX:**
At the point where `ClaimPanel` shows "Claim Your Reward", render adjacent to it:

```
┌─ Your Privacy Summary ─────────────────────────────────┐
│ ✅ PUBLIC (on-chain / in proof)                         │
│    track: "Data Engineering"                           │
│    bound_address: GDYDZMJF...                           │
│    nullifier: 0x8f3c9e...                               │
│                                                          │
│ 🔒 PRIVATE (never leaves your browser)                  │
│    name: "Alex Rivera"          [HIDDEN]                │
│    grade: "A"                   [HIDDEN]                │
│    courseName: "ZK Course"       [HIDDEN]                │
│    issueDate: "2024-05-15"      [HIDDEN]                │
└──────────────────────────────────────────────────────────┘
```

**Key Constraints:**
- The `hidden` attributes are read from the credential stored in DB (which the issuer minted) — they are NOT reconstructed from the proof. The credential attributes were stored at mint time.
- This is a **UI-only display** — no new data flows, no API changes, no on-chain writes
- The `raw.track` value is already stored alongside the hash in `Verification.disclosed` from the verify flow

**Tasks:**

- [ ] **Step 1: Build `PrivacyPanel.tsx`** — accepts `credential: Attributes` and `disclosed: string[]`; renders the two-column comparison; brand tokens; respects `prefers-reduced-motion`

- [ ] **Step 2: Wire into `ClaimPanel`** — fetch credential attributes server-side (from the verification record's `credentialId` or by joining through the verification's gate); pass to `PrivacyPanel` as prop alongside `disclosed.raw`

- [ ] **Step 3: Wire into result page** — at `/verify/result/[txHash]`, add `PrivacyPanel` below `ExplorerRevealPanel`; shows the holder what they proved vs. what they kept hidden

- [ ] **Step 4: Typecheck + lint + tests**

---

### Direction 3: Multi-Predicate Gates

**Files:**
- Modify: `circuits/zelyo_credential/src/main.nr` — extend to accept N disclosed attributes + N predicate checks
- Modify: `circuits/zelyo_credential/src/lib.nr` — predicate evaluation for multiple cases
- Modify: `packages/zk-shared/src/types.ts` — `PublicInputs.disclosed` becomes `disclosed: FieldHex[]` or a named map
- Modify: `apps/web/src/lib/prover.client.ts` — build public inputs for multiple disclosed attrs
- Modify: `apps/web/src/server/verification.service.ts` — adjust predicate checking in `claimGate`
- Modify: `apps/web/src/server/jobgate.service.ts` — `requiredPredicate` becomes `requiredPredicates: Predicate[]`
- Modify: `apps/web/prisma/schema.prisma` — `JobGate.requiredPredicate` becomes `requiredPredicates Json`
- Modify: `zk-build.mjs` — update `publicInputOrder` if ACIR layout changes
- Modify: seed gates with multiple predicates
- Test: `circuits/zelyo_credential/src/test/` — add multi-predicate test cases
- Test: `packages/zk-shared/test/parity.test.ts` — update for new disclosed format

**Circuit Change Sketch:**
The circuit currently checks: `disclosed == Poseidon(attribute)`. Multi-predicate extends to: for each `(attributeName, value)` in predicates, compute `Poseidon(value)` and check it equals the corresponding `disclosed[i]`. The `ProvePanel` checkbox UI becomes multi-select; the `Scope` app-tag still binds everything.

**Tasks:**

- [ ] **Step 1: Extend circuit** — `main.nr` accepts array of disclosed field elements + array of expected hashes; loop predicate checks
- [ ] **Step 2: Rebuild ACIR + VK** — `pnpm zk:build`; update `manifest.json`
- [ ] **Step 3: Update `zk-shared` types** — `disclosed: FieldHex[]`; update `buildPublicInputs` in prover
- [ ] **Step 4: Update `claimGate`** — loop over `requiredPredicates`, check each against `disclosed.raw`
- [ ] **Step 5: Update DB schema** — migrate `requiredPredicate` → `requiredPredicates`; update seed
- [ ] **Step 6: `cargo test` + parity test + typecheck + lint**

---

### Direction 4: Gate Marketplace

**Files:**
- Create: `apps/web/src/app/marketplace/page.tsx` — public gate browsing with issuer attribution
- Create: `apps/web/src/components/GateCard.tsx` — extend to show issuer name + claim count
- Modify: `apps/web/src/server/jobgate.service.ts` — add `listGates` with optional `issuerId` filter
- Modify: `apps/web/src/app/api/jobboard/gates/route.ts` — extend `GET` to accept `?issuer=` query param
- Create: `apps/web/src/app/api/issuers/[id]/gates/route.ts` — gates by issuer
- Modify: `apps/web/prisma/schema.prisma` — add `JobGate.issuerId` (optional; gates without an issuer are "platform" gates)
- Modify: seed — assign existing `data-engineering` gate to seeded issuer

**Tasks:**

- [ ] **Step 1: Add `issuerId` to `JobGate`** — nullable foreign key to `User`; update schema; migrate
- [ ] **Step 2: Update `createGate`** — accept optional `issuerId`; admin-created gates are "platform" (no issuerId)
- [ ] **Step 3: Extend `listGates`** — return `issuer { name }` in response
- [ ] **Step 4: Build `/marketplace` page** — filter by issuer; sort by reward amount; show claim counts from `GateClaim`
- [ ] **Step 5: Typecheck + lint + tests**

---

### Direction 5: Time-Limited Gates

**Files:**
- Modify: `apps/web/prisma/schema.prisma` — add `JobGate.expiresAt DateTime?`
- Modify: `apps/web/src/server/jobgate.service.ts` — `createGate` accepts `expiresAt`; `claimGate` checks expiry
- Modify: `apps/web/src/app/jobs/[slug]/ClaimPanel.tsx` — show countdown or "expired" state
- Modify: seed — add one time-limited gate for demo (e.g., expires in 24 hours)

**Constraint:** Time is checked server-side in `claimGate` (not enforced on-chain — this is a UX/cadence concern, not a security property). Expired gates still have their proofs work (the ZK proof itself is timeless); only the **claim** is blocked.

**Tasks:**

- [ ] **Step 1: Schema migration** — `expiresAt DateTime?`
- [ ] **Step 2: Update `createGate` + `claimGate`** — check `expiresAt` before issuing reward; throw `GATE_EXPIRED`
- [ ] **Step 3: `ClaimPanel` UI** — if `expiresAt` set and in past: show "This gate has expired"; if future: show "Claim expires in X hours"
- [ ] **Step 4: Typecheck + lint + tests**

---

## Suggested Execution Order for Hackathon Demo

Given time constraints, do in this order:

1. **Privacy Panel (Direction 2)** — lowest complexity, highest hackathon impact. Judges and non-technical viewers immediately "get" the ZK story from the comparison panel. Start here.

2. **Gate Creation + 2–3 Seed Gates (Direction 1, Steps 1–6)** — makes the platform feel real. Having 3 gates on the board instead of 1 changes the demo narrative from "look at this one pre-built gate" to "browse the job board."

3. **Time-Limited Gate (Direction 5)** — optional but easy to add once gate creation exists. One gate that expires in 24h shows the platform is alive.

The rest (Directions 3, 4) are post-hackathon.

---

## Phase Gate (Demo Readiness)

Demo is ready when:
- [ ] `/jobs` shows ≥3 gates with varied predicates and rewards
- [ ] Admin can create a new gate at `/issuer/gates` in <2 minutes
- [ ] Holder can: mint a credential → prove → verify → see Privacy Panel → claim → see Reward Unlocked
- [ ] Privacy Panel visibly shows what was revealed vs. hidden — a non-technical person can understand it
- [ ] `/` landing page clearly explains the three-step flow
- [ ] `typecheck && lint && test` all green
