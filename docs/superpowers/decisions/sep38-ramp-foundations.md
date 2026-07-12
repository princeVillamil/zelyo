# Decision: SEP-38 as the fiat on/off-ramp foundation

**Date:** 2026-07-10
**Status:** Accepted
**Related:** ROADMAP §2.3 (SEP-38), §2.5 (Anchor Platform), §2.6 (Circle), §2.7 (MoneyGram)

## Context

Roadmap item "Anchor Platform + SEP-38 + Circle/MoneyGram — fiat on/off-ramp layer" is a bundle of four separate integrations. Three require external dependencies Zelyo does not yet have: Anchor Platform (Docker infrastructure), Circle (money-transmitter license + compliance review), and MoneyGram (partnership + MGUSD trustline). SEP-38 (Anchor RFQ) talks to one configurable anchor URL and is fully mockable, so it is the only piece that can be built and tested end-to-end today without a partner.

## Decision

Implement **SEP-38 first** as the foundational slice, and have the other three reuse its primitives rather than each inventing their own.

Two shared primitives are introduced:

1. **`apps/web/src/lib/assets.ts`** — converts between Zelyo's inline `{ code, issuer }` asset representation (empty issuer = native XLM, per `lib/stellar.ts` / `jobgate.service.ts`) and the SEP-38 asset-id format (`stellar:native`, `stellar:CODE:ISSUER`, `iso4217:USD`). Circle, MoneyGram, and Anchor Platform all need to map between Stellar and fiat asset identifiers; this keeps the conversion in one place.

2. **`RampQuote` Prisma model** — persists firm SEP-38 quotes (anchor quote id, asset pair, amounts, price, fee, expiry, status). It is the audit trail for quotes today and the attachment point for payouts later: when Circle or MoneyGram executes against a quote, the payout record marks the quote `CONSUMED`.

## Consequences

- **Endpoint shape:** `GET /api/sep38/prices` (indicative, Redis-cached 30s, public + rate-limited), `POST /api/sep38/quote` (firm, ADMIN-gated, bearer-authenticated to the anchor, persisted), `GET /api/sep38/quote/[id]` (retrieval by local or anchor id).
- **Auth split:** indicative prices are public (cheap, cacheable); firm quotes require an ADMIN session because issuers request quotes for reward delivery (ROADMAP §2.3 goal) and firm quotes commit the anchor. Upstream auth to the anchor uses `SEP38_API_KEY` (bearer); if the chosen anchor later requires SEP-10 instead, that is a contained change inside `anchorFetch`.
- **Direction-agnostic:** SEP-38 quotes have no on/off-ramp concept; direction is inferred by the rail (Circle off-ramp, MoneyGram cash) that consumes the quote.
- **Out of scope this slice:** Anchor Platform client + SEP-12 proxy, Circle payouts, MoneyGram SEP-24, burn/clawback/trustline helpers, deposit detection. Each is a separate plan that reuses `assets.ts` + `RampQuote`.

## Risks

- No anchor partner is selected yet, so the integration is mock-backed in tests and non-functional until `SEP38_ANCHOR_URL` + `SEP38_API_KEY` are configured. This matches the roadmap's own §2.3 risk note ("Without a real anchor partner, this remains a mocked/stub integration").
