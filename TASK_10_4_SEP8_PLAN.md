# Task 10.4 Implementation Plan — SEP-8 Token-Gated Rewards

> Branch: `feat/sep8-token-gated-rewards`
> Status: Approved plan — DB-mirror approach, no contract changes, `FLAG` reward type left as-is.

## Context

Task 10.4 adds Stellar SEP-8 regulated-asset support to Zelyo. SEP-8 lets an issuer require pre-approval for transfers of a regulated asset. Zelyo will act as the approval server: a wallet submits a payment transaction XDR, the server checks whether the destination has a Zelyo ZK verification, and either co-signs the transaction (approved) or rejects it.

## Key decisions

1. **Source of truth for verified status: use the `Verification` DB mirror.**
   - Avoids a contract change + redeploy and aligns with the current Path-B (`server`) verification mode.
2. **GateForm integration: add a new `rewardType: "REGULATED_ASSET"`.**
   - Clearer semantics than a boolean flag and keeps `CLAIMABLE_BALANCE` unchanged.
3. **Do not fix the broken `FLAG` reward type in this task.**
   - Fixing it requires contract changes (`set_verified` / `is_verified`), a contract redeploy, and updating `CREDENTIAL_REGISTRY_CONTRACT_ID`. That is a separate, larger change.

## Known issue: `FLAG` reward type is broken

`apps/web/src/lib/stellar.ts#setVerifiedFlag` calls a `set_verified` method on the `CredentialRegistry` contract, but no such method exists in `contracts/credential_registry/src/lib.rs` or `storage.rs`. Any claim against a `FLAG` gate will fail at runtime. This plan intentionally does not address that issue.

## Implementation steps

### 1. SEP-8 approval service

**Create:** `apps/web/src/server/sep8.service.ts`

- Export Zod schema:
  ```ts
  export const approveTransactionBodySchema = z.object({
    tx: z.string().min(1, "Transaction envelope (base64 XDR) is required."),
  });
  ```
- Export response type:
  ```ts
  export type Sep8ApproveResult =
    | { status: "approved"; tx: string }
    | { status: "rejected"; error: string };
  ```
- `approveTransaction(body)`:
  1. Parse XDR with `TransactionBuilder.fromXDR(tx, env.NETWORK_PASSPHRASE)`.
  2. Inspect `tx.operations`. Only `Operation.Payment` is supported in v1.
  3. Skip native XLM. Reject assets whose issuer != `env.ISSUER_STELLAR_ACCOUNT`.
  4. Collect destinations.
  5. For each destination, check `db.verification.findFirst({ boundStellarAddress, result: "VERIFIED" })`.
  6. If all destinations are verified, sign with `issuerKeypair` and return `{ status: "approved", tx: signedXdr }`.
  7. Otherwise return `{ status: "rejected", error: "..." }`.

### 2. SEP-8 approval route

**Create:** `apps/web/src/app/api/sep8/approve/route.ts`

- `POST` handler mirroring `api/sep12/customer/route.ts`.
- Rate-limit with a new `sep8` limiter.
- Audit `SEP8_APPROVE` with `{ status: result.status }` only — no PII.
- Return approved/rejected as HTTP 200; 4xx/5xx only for malformed input, rate limits, or internal errors.

### 3. Rate limiter

**Modify:** `apps/web/src/lib/ratelimit.ts`

```ts
sep8: make("rl:sep8", 30),
```

### 4. Stellar envelope re-sign helper

**Modify:** `apps/web/src/lib/stellar.ts`

Add a helper to deserialize, sign, and re-serialize an XDR envelope.

### 5. GateForm regulated-asset support

**Modify:** `apps/web/src/app/(issuer)/issuer/gates/GateForm.tsx`

- Add `"REGULATED_ASSET"` to the `rewardType` enum.
- Add a radio button.
- Show asset config for both `CLAIMABLE_BALANCE` and `REGULATED_ASSET`.

### 6. Issuer gates API validation

**Modify:** `apps/web/src/app/api/issuer/gates/route.ts`

- Add `"REGULATED_ASSET"` to the schema.
- Ensure `REGULATED_ASSET` gates use an asset issued by `env.ISSUER_STELLAR_ACCOUNT`.

### 7. Job gate reward dispatch

**Modify:** `apps/web/src/server/jobgate.service.ts`

- Extend `CreateGateInput.rewardType` to include `"REGULATED_ASSET"`.
- Validate issuer in `createGate`.
- In `claimGate`, add a `REGULATED_ASSET` branch that issues the asset the same way as `CLAIMABLE_BALANCE`.

### 8. Tests

**Create:**
- `apps/web/src/server/__tests__/sep8.service.test.ts`
- `apps/web/src/app/api/sep8/approve/route.test.ts`

**Modify:**
- `apps/web/src/server/__tests__/jobgate.service.test.ts`

### 9. Docs

**Modify:** `docs/features.md` — append entry for SEP-8 approval server and regulated-asset rewards.

## Files to create or modify

- **Create**
  - `apps/web/src/server/sep8.service.ts`
  - `apps/web/src/server/__tests__/sep8.service.test.ts`
  - `apps/web/src/app/api/sep8/approve/route.ts`
  - `apps/web/src/app/api/sep8/approve/route.test.ts`
- **Modify**
  - `apps/web/src/lib/ratelimit.ts`
  - `apps/web/src/lib/stellar.ts`
  - `apps/web/src/app/(issuer)/issuer/gates/GateForm.tsx`
  - `apps/web/src/app/api/issuer/gates/route.ts`
  - `apps/web/src/server/jobgate.service.ts`
  - `apps/web/src/server/__tests__/jobgate.service.test.ts`
  - `docs/features.md`

## Verification

```bash
pnpm --filter @zelyo/web lint
pnpm --filter @zelyo/web typecheck
pnpm --filter @zelyo/web test
```

## Risks / prerequisites

- Issuer account must issue the regulated asset with `AUTHORIZATION_REQUIRED` + `AUTHORIZATION_REVOCABLE` for SEP-8 to matter on-chain.
- This plan uses the off-chain `Verification` mirror, not an on-chain verified flag.
- Existing `FLAG` reward type remains broken until the contract is extended separately.
- Approval server co-signs with `ISSUER_SECRET`; rate limiting is essential.
