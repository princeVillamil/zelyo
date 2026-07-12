# Zelyo UI live-demo fix — session handoff

## Branch

`ui/live-demo-fixes` (branched from `develop`)

## Route inventory

| File path (from `apps/web/src/app`) | Public route |
|---|---|
| `page.tsx` | `/` |
| `(auth)/login/page.tsx` | `/login` |
| `(auth)/register/page.tsx` | `/register` |
| `(issuer)/issuer/page.tsx` | `/issuer` |
| `(issuer)/issuer/credentials/page.tsx` | `/issuer/credentials` |
| `(issuer)/issuer/gates/page.tsx` | `/issuer/gates` |
| `(issuer)/issuer/mint/page.tsx` | `/issuer/mint` |
| `jobs/page.tsx` | `/jobs` |
| `jobs/[slug]/page.tsx` | `/jobs/:slug` |
| `verify/result/[txHash]/page.tsx` | `/verify/result/:txHash` |
| `wallet/page.tsx` | `/wallet` |
| `wallet/credentials/[id]/page.tsx` | `/wallet/credentials/:id` |
| `wallet/keys/page.tsx` | `/wallet/keys` |
| `wallet/prove/[id]/page.tsx` | `/wallet/prove/:id` |

## What was changed in this session

All changes are visual/presentational; no business logic or data models were touched.

### Design-system component

- **`apps/web/src/components/StatusPill.tsx`**
  - Added `tone="primary"` variant.
  - Switched from `rounded-full` to `rounded` to match BRAND.md crisp corners.

### Wallet

- **`apps/web/src/components/wallet/CredentialCard.tsx`**
  - Kept the dark `foil-stamp` card (product decision).
  - Added `manuscript-glow`.
  - Changed body copy to `text-on-primary` for stronger contrast.
  - Badges now use brand `rounded` radius and token opacities (`bg-on-primary/10`, `bg-error/20`).
  - Removed raw `bg-white/10` from the disabled "Prove" state.

- **`apps/web/src/components/wallet/CredentialCard.test.tsx`**
  - Added assertions that the card keeps `foil-stamp` + `manuscript-glow` and does not use `rounded-full`.

### Identity Keys (`/wallet/keys`)

- **`apps/web/src/components/wallet/KeysManager.tsx`**
  - Split the previously stacked Generate + Restore flows into a single-page tabbed panel.
  - Added a `mode` state (`"generate" | "restore"`) with a bottom-right toggle styled like the top-right `SectionNav`.
  - Generate flow uses `<FoilStampButton>`.
  - Restore flow uses `<PrimaryButton>`.
  - Active panel is wrapped in a light registry-page card (`manuscript-glow`, `bg-surface-container-lowest`, `border-outline-variant`).
  - Errors now use the shared alert pattern with `role="alert"`.

- **`apps/web/src/components/wallet/KeysManager.test.tsx`**
  - Restore test now switches to the Restore tab before filling the form.

### Jobs / public board

- **`apps/web/src/components/GateCard.tsx`**
  - Replaced inline Open/Expired badge with `<StatusPill tone={...} />`.
  - Hover border changed to `border-primary`.

- **`apps/web/src/app/jobs/[slug]/PrivacyPanel.tsx`**
  - Removed `foil-stamp`; converted to a light registry-page card with left evergreen spine.
  - Fixed `bound_address` and `nullifier` truncation by using `break-all`.
  - Section icons now use token surfaces.

- **`apps/web/src/app/jobs/[slug]/ClaimPanel.tsx`**
  - "Claim Your Reward" now uses `<FoilStampButton>`.
  - Errors are wrapped in the shared alert pattern (`border-l-4 border-error bg-error-container/40 ...`) with `role="alert"`.

- **`apps/web/src/app/jobs/[slug]/page.tsx`**
  - Required predicates now render inside the same spec-card style used in `GateCard`.

### Global layout / chrome

- **`apps/web/src/app/layout.tsx`**
  - Max-width changed from `1400px` to `1120px` to match BRAND.md §4.

- **`apps/web/src/components/SiteRail.tsx`**
  - Replaced arbitrary `text-[15px]` with `text-label-md`.

### Homepage

- **No changes.** `homepage/styles.css` and `homepage/index.html` were reverted to their original state. The user decided to keep the static homepage untouched for now.

## Tests / quality

- `pnpm --filter @zelyo/web test` → **165 passed**
- `pnpm --filter @zelyo/web typecheck` → clean
- `pnpm --filter @zelyo/web lint` → only 2 pre-existing warnings in `(issuer)/issuer/gates/GateForm.tsx` and `(issuer)/issuer/mint/MintForm.tsx`

## Still open / next-session candidates

If you pick this up later, the remaining BRAND.md polish items are:

- Static homepage alignment (the user deferred this).
- Replace the remaining inline foil CTA in `app/page.tsx` with `<FoilStampButton>` (low priority).
- Add a reduced-motion guard for `html { scroll-behavior: smooth }` if desired.

## Commands to verify

```bash
pnpm --filter @zelyo/web test
pnpm --filter @zelyo/web typecheck
pnpm --filter @zelyo/web lint
```

## Files modified this session

```
M apps/web/src/app/jobs/[slug]/ClaimPanel.tsx
M apps/web/src/app/jobs/[slug]/PrivacyPanel.tsx
M apps/web/src/app/jobs/[slug]/page.tsx
M apps/web/src/app/layout.tsx
M apps/web/src/components/GateCard.tsx
M apps/web/src/components/SiteRail.tsx
M apps/web/src/components/StatusPill.tsx
M apps/web/src/components/__tests__/GateCard.test.tsx
M apps/web/src/components/__tests__/StatusPill.test.tsx
M apps/web/src/components/wallet/CredentialCard.test.tsx
M apps/web/src/components/wallet/CredentialCard.tsx
M apps/web/src/components/wallet/KeysManager.test.tsx
M apps/web/src/components/wallet/KeysManager.tsx
```

## Brand reference

Keep `BRAND.md` open. Tokens are authoritative; the web app uses Tailwind CSS v4 CSS-first `@theme` in `apps/web/src/app/globals.css`.
