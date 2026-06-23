# Phase 5 — Holder Wallet + Prove/Verify

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the holder a wallet that generates and stores the identity secret `s` entirely client-side, lets them prove one credential fact in-browser (Noir + bb.js UltraHonk) with selective disclosure and Stellar address binding, and submit that proof through `verifyAndRegister` so the chain records only a nullifier — routing to the verification result.

**Architecture:** Client-only key lib (`holder-key.client.ts`) + prover (`prover.client.ts`) run under COOP/COEP cross-origin isolation; `s` never touches the network — only `idCommitment = Poseidon(s)` is `PUT`. A thin `verification.service.ts` implements the Phase 0 `verifyAndRegister` contract (Path A on-chain `verify_and_register`, Path B server-verify-then-`register`), fast-failing on bad root / used nullifier and mirroring `Nullifier` + `Verification`. Route handlers stay thin (validate → authorize → service); wallet pages are BRAND-styled, Client Components only where WASM/interactivity is required.

**Tech Stack:** Next.js 16.2 App Router · React 19.2 · TypeScript 6 (strict) · `@noir-lang/noir_js` + `@noir-lang/noir_wasm` beta.22 · `@aztec/bb.js` 4.3 UltraHonk · `@stellar/stellar-sdk` 16 · Prisma 7.8 · Zod 4 · `rate-limiter-flexible` 11 + `ioredis` 5 · Vitest 4 · Tailwind v4.

**Prerequisites:** Phase 1 (circuit artifact + zk-shared: `poseidon`, `idCommitment`, `buildLeaf`, `computeNullifier`, `computeScope`, `encodeAddressToField`, `MERKLE_DEPTH`, `FieldHex`, `Attributes`, `PublicInputs`, `ProofBundle`), Phase 2 (registry `verify_and_register`/`register`/`is_root_valid`/`is_nullifier_used`), Phase 3 (auth + RBAC middleware, libs: `db`, `redis`, `logger`, `stellar`, `storage`, `env`, `AppError`, `rate-limiter`; components: foil-stamp button, typewriter log, ledger lines, registry cards), Phase 4 (credentials exist with `Leaf`/`RootHistory`; `merkle.service.ts` `getMerkleProof`/`getCurrentRoot`; `/api/circuit/manifest`).

**Gate:** see "Phase Gate" at the end. Do not start Phase 6 until it passes.

## Global Constraints

Apply to **every task** below (copied from the index / SPEC / AGENT; the stricter security rule wins):

- **Version floors (pin exact in lockfile; never downgrade):** Node ≥ 22 · pnpm 10 · Next.js 16.2.x · React/React DOM 19.2.x · TypeScript 6.0.x · `@noir-lang/noir_js` + `@noir-lang/noir_wasm` beta.22 · `@aztec/bb.js` 4.3.x · `@stellar/stellar-sdk` 16.x · Prisma 7.8.x · Zod 4.x · `ioredis` 5.x + `rate-limiter-flexible` 11.x · Vitest 4.x · Tailwind 4.3.x. Verify with `pnpm view <pkg> version` before pinning.
- **TypeScript:** `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. No `any`; `unknown` + Zod at boundaries.
- **Privacy:** the holder secret `s` is generated with WebCrypto in the browser, stored encrypted in IndexedDB + user-exportable backup, and **never transmitted**. The server only ever sees `id_commitment = Poseidon(s)` and nullifiers; it rejects any payload that would contain `s`. Personal data (name/grade/attributes) never goes on-chain, in logs, in analytics, or in client bundles.
- **Cross-origin isolation:** the app and the prover/artifact routes are served with `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`. Without these, bb.js WASM threads silently fail. Test in a real browser, not just SSR. (Headers are wired in `next.config.ts` in Phase 3/7; this phase asserts the dependency and degrades gracefully when `crossOriginIsolated` is false.)
- **Thin handlers:** validate (Zod) → authorize (RBAC re-check in handler) → call a `src/server/*` service → map to typed response. Business logic in services. Errors throw `AppError(code, httpStatus, publicMessage)`; one boundary maps to `{ error: { code, message } }`; never leak stack/DB errors.
- **RBAC:** `HOLDER` for `/wallet/**` and holder APIs; re-checked in every handler, never trusting client-sent role. `/api/verify` and `/api/verify/[txHash]` are public.
- **Rate limits (per IP, `rate-limiter-flexible` + Redis):** `/api/verify` 20/min → `429` with `Retry-After`.
- **Logging:** structured `pino`; redact `s`, attributes, `authorization`, `password`, `set-cookie`. Log a request id. The mirror (Postgres) never authorizes anything — the chain is source of truth.
- **`scope`** must match between client (`ZK_SCOPE_APP_ID` + chain id + registry id) and contract; bind the proof to `boundAddress`; the contract asserts it equals the invoker. Duplicate nullifier reverts (`NullifierUsed`) — that revert **is** the Sybil block; surface it cleanly.
- **Conventions:** Conventional Commits. Server-only modules carry `import "server-only";`. Client-only modules carry `"use client";`. Files touching `s` or the prover are `*.client.ts` / Client Components. One foil-stamp CTA per view; match `BRAND.md` tokens exactly; respect `prefers-reduced-motion`. New env vars go in `.env.example` **and** `src/lib/env.ts`.

Run unit tests with `pnpm --filter web test`. Definition of done per task: builds; `pnpm --filter web typecheck && pnpm --filter web lint` pass; task tests pass; inputs Zod-validated; mutating routes RBAC-guarded + rate-limited; no secret/PII logged or shipped to client; visibly matches `BRAND.md`.

---

### Task 1: Client-side holder key library (`holder-key.client.ts`)

Generate `s` with WebCrypto, persist it encrypted in IndexedDB, export/restore a backup blob, and derive `idCommitment = Poseidon(s)`. `s` is never serialized to the network.

**Files:**
- Create: `apps/web/src/lib/holder-key.client.ts`
- Test: `apps/web/src/lib/holder-key.client.test.ts`

**Interfaces:**
- Consumes (from `packages/zk-shared`, Phase 1): `idCommitment(s: FieldHex): FieldHex`, `type FieldHex`.
- Produces (used by Tasks 6, 9):
  - `generateHolderSecret(): Promise<FieldHex>` — WebCrypto 32-byte random reduced into BN254 field, returned as `FieldHex`.
  - `persistHolderSecret(s: FieldHex, passphrase: string): Promise<void>` — AES-GCM encrypt under a PBKDF2 key from `passphrase`, store ciphertext in IndexedDB (`zelyo` DB, `keys` store, id `"holder"`).
  - `loadHolderSecret(passphrase: string): Promise<FieldHex | null>` — decrypt from IndexedDB; `null` if absent; throws `HolderKeyError("DECRYPT_FAILED")` on wrong passphrase.
  - `hasHolderSecret(): Promise<boolean>`.
  - `exportBackup(s: FieldHex, passphrase: string): Promise<string>` — JSON backup blob (versioned, base64 fields), no plaintext `s`.
  - `restoreBackup(blob: string, passphrase: string): Promise<FieldHex>` — decrypt a backup blob back to `s`.
  - `deriveIdCommitment(s: FieldHex): FieldHex` — wraps zk-shared `idCommitment`.
  - `class HolderKeyError extends Error { code: "DECRYPT_FAILED" | "BAD_BACKUP" }`.

- [ ] **Step 1: Add `fake-indexeddb` dev dep so the lib is testable under jsdom**

Run: `pnpm --filter web add -D fake-indexeddb`

Confirm `apps/web/vitest.config.ts` (created Phase 3) uses `environment: "jsdom"`. If a setup file exists, add `import "fake-indexeddb/auto";` to it; otherwise create `apps/web/vitest.setup.ts` with that single line and reference it via `test: { setupFiles: ["./vitest.setup.ts"] }`.

- [ ] **Step 2: Write the failing test**

```ts
// apps/web/src/lib/holder-key.client.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  generateHolderSecret,
  persistHolderSecret,
  loadHolderSecret,
  hasHolderSecret,
  exportBackup,
  restoreBackup,
  deriveIdCommitment,
  HolderKeyError,
} from "./holder-key.client";

const wipe = () =>
  new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase("zelyo");
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });

describe("holder-key.client", () => {
  beforeEach(wipe);

  it("generates a 0x field hex secret", async () => {
    const s = await generateHolderSecret();
    expect(s).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("persists then restores the same secret with the right passphrase", async () => {
    const s = await generateHolderSecret();
    expect(await hasHolderSecret()).toBe(false);
    await persistHolderSecret(s, "correct horse");
    expect(await hasHolderSecret()).toBe(true);
    const restored = await loadHolderSecret("correct horse");
    expect(restored).toBe(s);
  });

  it("rejects the wrong passphrase with DECRYPT_FAILED", async () => {
    const s = await generateHolderSecret();
    await persistHolderSecret(s, "right");
    await expect(loadHolderSecret("wrong")).rejects.toMatchObject({ code: "DECRYPT_FAILED" });
    expect(HolderKeyError).toBeTypeOf("function");
  });

  it("round-trips an export/restore backup blob without leaking plaintext s", async () => {
    const s = await generateHolderSecret();
    const blob = await exportBackup(s, "pass");
    expect(blob).not.toContain(s.slice(2)); // raw hex never appears
    expect(blob).not.toContain(s);
    const restored = await restoreBackup(blob, "pass");
    expect(restored).toBe(s);
    await expect(restoreBackup(blob, "nope")).rejects.toMatchObject({ code: "DECRYPT_FAILED" });
    await expect(restoreBackup("{not a backup}", "pass")).rejects.toMatchObject({ code: "BAD_BACKUP" });
  });

  it("derives idCommitment deterministically and never serializes s to a network shape", async () => {
    const s = await generateHolderSecret();
    const c1 = deriveIdCommitment(s);
    const c2 = deriveIdCommitment(s);
    expect(c1).toBe(c2);
    expect(c1).toMatch(/^0x[0-9a-f]{64}$/);
    // The only value ever sent to the server is idCommitment, never s.
    const networkPayload = JSON.stringify({ idCommitment: c1 });
    expect(networkPayload).not.toContain(s);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter web test holder-key.client`
Expected: FAIL — `Failed to resolve import "./holder-key.client"` / functions not defined.

- [ ] **Step 4: Write minimal implementation**

```ts
// apps/web/src/lib/holder-key.client.ts
"use client";

import { idCommitment, type FieldHex } from "@zelyo/zk-shared";

// BN254 scalar field modulus.
const FIELD_MODULUS =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

const DB_NAME = "zelyo";
const STORE = "keys";
const RECORD_ID = "holder";
const BACKUP_VERSION = 1;

export class HolderKeyError extends Error {
  constructor(public readonly code: "DECRYPT_FAILED" | "BAD_BACKUP") {
    super(code);
    this.name = "HolderKeyError";
  }
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
function bytesToBigInt(bytes: Uint8Array): bigint {
  let v = 0n;
  for (const b of bytes) v = (v << 8n) | BigInt(b);
  return v;
}
function fieldHex(v: bigint): FieldHex {
  return ("0x" + (v % FIELD_MODULUS).toString(16).padStart(64, "0")) as FieldHex;
}
function b64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function unb64(s: string): Uint8Array {
  const bin = atob(s);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function generateHolderSecret(): Promise<FieldHex> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  return fieldHex(bytesToBigInt(raw));
}

export function deriveIdCommitment(s: FieldHex): FieldHex {
  return idCommitment(s);
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 250_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

interface Envelope {
  v: number;
  salt: string;
  iv: string;
  ct: string;
}

async function seal(s: FieldHex, passphrase: string): Promise<Envelope> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  // Store the field hex (without 0x) as bytes — never the raw decimal/string in clear.
  const plaintext = new TextEncoder().encode(s);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext),
  );
  return { v: BACKUP_VERSION, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}

async function open(env: Envelope, passphrase: string): Promise<FieldHex> {
  const key = await deriveKey(passphrase, unb64(env.salt));
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: unb64(env.iv) },
      key,
      unb64(env.ct),
    );
  } catch {
    throw new HolderKeyError("DECRYPT_FAILED");
  }
  return new TextDecoder().decode(plain) as FieldHex;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const store = db.transaction(STORE, mode).objectStore(STORE);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function persistHolderSecret(s: FieldHex, passphrase: string): Promise<void> {
  const envelope = await seal(s, passphrase);
  await tx("readwrite", (store) => store.put(envelope, RECORD_ID));
}

export async function hasHolderSecret(): Promise<boolean> {
  const v = await tx<Envelope | undefined>("readonly", (store) => store.get(RECORD_ID));
  return v != null;
}

export async function loadHolderSecret(passphrase: string): Promise<FieldHex | null> {
  const env = await tx<Envelope | undefined>("readonly", (store) => store.get(RECORD_ID));
  if (!env) return null;
  return open(env, passphrase);
}

export async function exportBackup(s: FieldHex, passphrase: string): Promise<string> {
  const env = await seal(s, passphrase);
  return JSON.stringify({ kind: "zelyo-holder-backup", ...env });
}

export async function restoreBackup(blob: string, passphrase: string): Promise<FieldHex> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(blob);
  } catch {
    throw new HolderKeyError("BAD_BACKUP");
  }
  const e = parsed as Partial<Envelope> & { kind?: string };
  if (e.kind !== "zelyo-holder-backup" || !e.salt || !e.iv || !e.ct) {
    throw new HolderKeyError("BAD_BACKUP");
  }
  return open({ v: e.v ?? BACKUP_VERSION, salt: e.salt, iv: e.iv, ct: e.ct }, passphrase);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter web test holder-key.client`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/holder-key.client.ts apps/web/src/lib/holder-key.client.test.ts apps/web/vitest.setup.ts apps/web/package.json
git commit -m "feat(wallet): client-only holder secret lib with encrypted IndexedDB + backup"
```

---

### Task 2: In-browser prover (`prover.client.ts`)

Load the circuit artifact via `/api/circuit/manifest`, execute the circuit witness, generate an UltraHonk proof with bb.js, and assemble a `ProofBundle` whose `PublicInputs` are built with zk-shared. Client-only; requires cross-origin isolation.

**Files:**
- Create: `apps/web/src/lib/prover.client.ts`
- Test: `apps/web/src/lib/prover.client.test.ts`

**Interfaces:**
- Consumes:
  - zk-shared (Phase 1): `computeScope(appId, chainId, registryId): FieldHex`, `computeNullifier(s, scope): FieldHex`, `encodeAddressToField(stellarPubKey): FieldHex`, `type FieldHex`, `type Attributes`, `type PublicInputs`, `type ProofBundle`, `MERKLE_DEPTH`.
  - `/api/circuit/manifest` (Phase 4) returning `{ acirUrl, abiUrl, vkUrl, hash, scope: { appId, chainId, registryId } }`.
- Produces (used by Task 6):
  - `interface ProveInput { s: FieldHex; attributes: Attributes; disclose: { track: boolean }; merklePath: { siblings: FieldHex[]; pathIndices: number[] }; root: FieldHex; boundStellarAddress: string; }`
  - `assertCrossOriginIsolated(): void` — throws `ProverError("NOT_ISOLATED")` when `globalThis.crossOriginIsolated !== true`.
  - `buildPublicInputs(input, scope): PublicInputs` — pure; builds `{ root, scope, boundAddress, nullifier, disclosed }` from zk-shared.
  - `proveCredential(input: ProveInput, deps?: ProverDeps): Promise<ProofBundle>` — full pipeline; `deps` is an injection seam for tests.
  - `interface ProverDeps { fetchManifest; loadNoir; loadBackend; }`
  - `class ProverError extends Error { code: "NOT_ISOLATED" | "MANIFEST" | "EXECUTE" | "PROVE" }`.

- [ ] **Step 1: Add proving deps**

Run: `pnpm --filter web add @noir-lang/noir_js @noir-lang/noir_wasm @aztec/bb.js`
(Pin the beta.22 / 4.3.x lines resolved at install per Global Constraints.)

- [ ] **Step 2: Write the failing test (pure parts + injected pipeline; no real WASM in unit tests)**

```ts
// apps/web/src/lib/prover.client.test.ts
import { describe, it, expect, vi } from "vitest";
import {
  buildPublicInputs,
  assertCrossOriginIsolated,
  proveCredential,
  ProverError,
  type ProveInput,
} from "./prover.client";
import { computeScope, computeNullifier, encodeAddressToField, type FieldHex } from "@zelyo/zk-shared";

const SCOPE = computeScope("zelyo-v1", "Test SDF Network ; September 2015", "CDREG...");
const ADDR = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";

const input: ProveInput = {
  s: ("0x" + "11".repeat(32)) as FieldHex,
  attributes: {
    track: "Data Engineering",
    grade: "A",
    issueDate: "2026-01-01",
    courseName: "Distributed Systems",
    learnerName: "Ada Lovelace",
  },
  disclose: { track: true },
  merklePath: { siblings: [("0x" + "00".repeat(32)) as FieldHex], pathIndices: [0] },
  root: ("0x" + "ab".repeat(32)) as FieldHex,
  boundStellarAddress: ADDR,
};

describe("prover.client", () => {
  it("builds public inputs from zk-shared (scope, nullifier, bound address)", () => {
    const pi = buildPublicInputs(input, SCOPE);
    expect(pi.root).toBe(input.root);
    expect(pi.scope).toBe(SCOPE);
    expect(pi.nullifier).toBe(computeNullifier(input.s, SCOPE));
    expect(pi.boundAddress).toBe(encodeAddressToField(ADDR));
    expect(pi.disclosed).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("throws NOT_ISOLATED when cross-origin isolation is off", () => {
    vi.stubGlobal("crossOriginIsolated", false);
    expect(() => assertCrossOriginIsolated()).toThrowError(ProverError);
    expect(() => assertCrossOriginIsolated()).toThrowError(/NOT_ISOLATED/);
    vi.unstubAllGlobals();
  });

  it("runs the pipeline with injected deps and returns a ProofBundle", async () => {
    vi.stubGlobal("crossOriginIsolated", true);
    const proof = new Uint8Array([1, 2, 3]);
    const deps = {
      fetchManifest: vi.fn().mockResolvedValue({
        acirUrl: "/circuit/acir.json",
        abiUrl: "/circuit/abi.json",
        vkUrl: "/circuit/vk.bin",
        hash: "deadbeef",
        scope: { appId: "zelyo-v1", chainId: "Test SDF Network ; September 2015", registryId: "CDREG..." },
      }),
      loadNoir: vi.fn().mockResolvedValue({
        execute: vi.fn().mockResolvedValue({ witness: new Uint8Array([9]) }),
      }),
      loadBackend: vi.fn().mockResolvedValue({
        generateProof: vi.fn().mockResolvedValue({ proof, publicInputs: [] }),
      }),
    };
    const bundle = await proveCredential(input, deps);
    expect(bundle.proof).toBe(proof);
    expect(bundle.publicInputs.nullifier).toBe(computeNullifier(input.s, SCOPE));
    expect(deps.loadNoir).toHaveBeenCalledOnce();
    expect(deps.loadBackend).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("never includes the raw secret s in the produced bundle", async () => {
    vi.stubGlobal("crossOriginIsolated", true);
    const deps = {
      fetchManifest: vi.fn().mockResolvedValue({
        acirUrl: "a", abiUrl: "b", vkUrl: "c", hash: "h",
        scope: { appId: "zelyo-v1", chainId: "Test SDF Network ; September 2015", registryId: "CDREG..." },
      }),
      loadNoir: vi.fn().mockResolvedValue({ execute: vi.fn().mockResolvedValue({ witness: new Uint8Array() }) }),
      loadBackend: vi.fn().mockResolvedValue({ generateProof: vi.fn().mockResolvedValue({ proof: new Uint8Array(), publicInputs: [] }) }),
    };
    const bundle = await proveCredential(input, deps);
    expect(JSON.stringify(bundle.publicInputs)).not.toContain(input.s);
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter web test prover.client`
Expected: FAIL — `Failed to resolve import "./prover.client"`.

- [ ] **Step 4: Write minimal implementation**

```ts
// apps/web/src/lib/prover.client.ts
"use client";

import {
  computeScope,
  computeNullifier,
  encodeAddressToField,
  poseidon,
  type FieldHex,
  type Attributes,
  type PublicInputs,
  type ProofBundle,
} from "@zelyo/zk-shared";

export class ProverError extends Error {
  constructor(public readonly code: "NOT_ISOLATED" | "MANIFEST" | "EXECUTE" | "PROVE") {
    super(code);
    this.name = "ProverError";
  }
}

export interface ProveInput {
  s: FieldHex;
  attributes: Attributes;
  disclose: { track: boolean };
  merklePath: { siblings: FieldHex[]; pathIndices: number[] };
  root: FieldHex;
  boundStellarAddress: string;
}

interface CircuitManifest {
  acirUrl: string;
  abiUrl: string;
  vkUrl: string;
  hash: string;
  scope: { appId: string; chainId: string; registryId: string };
}

interface NoirLike {
  execute(inputs: Record<string, unknown>): Promise<{ witness: Uint8Array }>;
}
interface BackendLike {
  generateProof(witness: Uint8Array): Promise<{ proof: Uint8Array; publicInputs: string[] }>;
}

export interface ProverDeps {
  fetchManifest(): Promise<CircuitManifest>;
  loadNoir(manifest: CircuitManifest): Promise<NoirLike>;
  loadBackend(manifest: CircuitManifest): Promise<BackendLike>;
}

export function assertCrossOriginIsolated(): void {
  if ((globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated !== true) {
    throw new ProverError("NOT_ISOLATED");
  }
}

// `disclosed` is the encoding of the single revealed attribute (track).
function encodeTrack(track: string): FieldHex {
  const bytes = new TextEncoder().encode(track);
  let v = 0n;
  for (const b of bytes) v = (v << 8n) | BigInt(b);
  const field = ("0x" + v.toString(16).padStart(64, "0")) as FieldHex;
  return poseidon([field]);
}

export function buildPublicInputs(input: ProveInput, scope: FieldHex): PublicInputs {
  return {
    root: input.root,
    scope,
    boundAddress: encodeAddressToField(input.boundStellarAddress),
    nullifier: computeNullifier(input.s, scope),
    disclosed: encodeTrack(input.attributes.track),
  };
}

// Default deps: dynamic-import the WASM packages only in the browser, lazily.
const defaultDeps: ProverDeps = {
  async fetchManifest() {
    const res = await fetch("/api/circuit/manifest", { cache: "force-cache" });
    if (!res.ok) throw new ProverError("MANIFEST");
    return (await res.json()) as CircuitManifest;
  },
  async loadNoir(manifest) {
    const { Noir } = await import("@noir-lang/noir_js");
    const acir = await (await fetch(manifest.acirUrl)).json();
    return new Noir(acir) as unknown as NoirLike;
  },
  async loadBackend(manifest) {
    const { UltraHonkBackend } = await import("@aztec/bb.js");
    const acir = await (await fetch(manifest.acirUrl)).json();
    return new UltraHonkBackend(acir.bytecode) as unknown as BackendLike;
  },
};

export async function proveCredential(
  input: ProveInput,
  deps: ProverDeps = defaultDeps,
): Promise<ProofBundle> {
  assertCrossOriginIsolated();

  const manifest = await deps.fetchManifest();
  const scope = computeScope(
    manifest.scope.appId,
    manifest.scope.chainId,
    manifest.scope.registryId,
  );
  const publicInputs = buildPublicInputs(input, scope);

  const noir = await deps.loadNoir(manifest);
  let witness: Uint8Array;
  try {
    const result = await noir.execute({
      s: input.s,
      attributes: input.attributes,
      merkle_path: input.merklePath,
      root: publicInputs.root,
      scope: publicInputs.scope,
      bound_address: publicInputs.boundAddress,
      nullifier: publicInputs.nullifier,
      disclosed: publicInputs.disclosed,
    });
    witness = result.witness;
  } catch {
    throw new ProverError("EXECUTE");
  }

  const backend = await deps.loadBackend(manifest);
  let proof: Uint8Array;
  try {
    ({ proof } = await backend.generateProof(witness));
  } catch {
    throw new ProverError("PROVE");
  }

  return { proof, publicInputs };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter web test prover.client`
Expected: PASS (4 tests).

- [ ] **Step 6: Document the cross-origin-isolation requirement + real-browser test note**

Add a top-of-file comment block in `prover.client.ts`:

```ts
// PROVING RUNS CLIENT-SIDE ONLY. bb.js (Barretenberg) uses WASM threads via
// SharedArrayBuffer, which requires the page to be cross-origin isolated:
//   Cross-Origin-Opener-Policy: same-origin
//   Cross-Origin-Embedder-Policy: require-corp
// These are set in next.config.ts on the app + /circuit + prover routes.
// Without them `globalThis.crossOriginIsolated` is false and proving silently
// fails — assertCrossOriginIsolated() turns that into a clear ProverError.
// REAL-BROWSER TEST: unit tests inject deps (no WASM). Verify true proving in a
// real browser via the Phase 7 Playwright "selective disclosure" e2e on
// /wallet/prove/[id], which loads the actual circuit artifact under COOP/COEP.
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/prover.client.ts apps/web/src/lib/prover.client.test.ts apps/web/package.json
git commit -m "feat(wallet): in-browser UltraHonk prover (zk-shared public inputs, COOP/COEP guard)"
```

---

### Task 3: Verification service (`verification.service.ts`)

Implement the cross-phase `verifyAndRegister(bundle): Promise<VerifyResult>`: fast-fail pre-checks (root validity + nullifier-not-mirrored), then submit Path A `verify_and_register` or Path B verify-then-`register`, map `NullifierUsed` to `NULLIFIER_USED`, mirror `Nullifier` + `Verification`, and return the contract tx + explorer URL.

**Files:**
- Create: `apps/web/src/server/verification.service.ts`
- Test: `apps/web/src/server/verification.service.test.ts`

**Interfaces:**
- Consumes:
  - zk-shared: `type ProofBundle`, `type PublicInputs`, `type FieldHex`.
  - `src/lib/stellar.ts` (Phase 3) extended here with: `submitVerifyAndRegister(bundle: ProofBundle): Promise<{ txHash: string }>` (Path A), `submitRegister(pi: PublicInputs): Promise<{ txHash: string }>` (Path B), `verifyProofOffchain(bundle: ProofBundle): Promise<boolean>` (Path B), `isRootValid(root: FieldHex): Promise<boolean>`, `isNullifierUsed(nullifier: FieldHex): Promise<boolean>`, `explorerTxUrl(txHash: string): string`. A thrown error carrying `.contractError === "NullifierUsed"` signals a Sybil revert.
  - `src/lib/env.ts`: `ZK_VERIFY_MODE` (`"onchain" | "server"`), `NEXT_PUBLIC_EXPLORER_BASE`.
  - `src/lib/db.ts` Prisma client; models `RootHistory`, `Nullifier`, `Verification`, enum `VerificationResult`.
  - `src/lib/logger.ts`, `src/lib/errors.ts` (`AppError`).
- Produces (contract from Phase 0 index — exact):
  - `type VerifyResult = { ok: boolean; result: VerificationResult; txHash?: string; explorerUrl?: string }`.
  - `async function verifyAndRegister(bundle: ProofBundle): Promise<VerifyResult>`.
  - `VerificationResult` mirrors Prisma: `VERIFIED | INVALID_PROOF | UNKNOWN_ROOT | NULLIFIER_USED | ERROR`.

- [ ] **Step 1: Add stellar verification helpers (thin wrappers; real RPC wired in Phase 7 deploy)**

Append to `apps/web/src/lib/stellar.ts` (created Phase 3). These call the registry contract via `@stellar/stellar-sdk` signed with `ISSUER_SECRET`; in unit tests they are mocked.

```ts
// apps/web/src/lib/stellar.ts  (additions)
import { env } from "@/lib/env";
import type { ProofBundle, PublicInputs, FieldHex } from "@zelyo/zk-shared";

export class ContractError extends Error {
  constructor(public readonly contractError: "NullifierUsed" | "UnknownRoot" | "AddressMismatch" | "InvalidProof") {
    super(contractError);
    this.name = "ContractError";
  }
}

export function explorerTxUrl(txHash: string): string {
  return `${env.NEXT_PUBLIC_EXPLORER_BASE}/tx/${txHash}`;
}

export async function isRootValid(_root: FieldHex): Promise<boolean> {
  /* invoke CredentialRegistry.is_root_valid via Soroban RPC */
  throw new Error("not implemented in this phase; mocked in tests, wired in Phase 7");
}
export async function isNullifierUsed(_nullifier: FieldHex): Promise<boolean> {
  /* invoke is_nullifier_used */
  throw new Error("not implemented in this phase; mocked in tests, wired in Phase 7");
}
export async function submitVerifyAndRegister(_bundle: ProofBundle): Promise<{ txHash: string }> {
  /* Path A: verify_and_register(proof, pi) signed by ISSUER_SECRET; throws ContractError on revert */
  throw new Error("not implemented in this phase; mocked in tests, wired in Phase 7");
}
export async function submitRegister(_pi: PublicInputs): Promise<{ txHash: string }> {
  /* Path B: register(pi, attestor) signed by ISSUER_SECRET; throws ContractError on revert */
  throw new Error("not implemented in this phase; mocked in tests, wired in Phase 7");
}
export async function verifyProofOffchain(_bundle: ProofBundle): Promise<boolean> {
  /* Path B: bb.js / nargo verify server-side */
  throw new Error("not implemented in this phase; mocked in tests, wired in Phase 7");
}
```

- [ ] **Step 2: Write the failing test (one assertion per `VerificationResult` branch, chain mocked)**

```ts
// apps/web/src/server/verification.service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProofBundle, FieldHex } from "@zelyo/zk-shared";

vi.mock("@/lib/stellar", () => ({
  ContractError: class ContractError extends Error {
    constructor(public contractError: string) { super(contractError); }
  },
  explorerTxUrl: (h: string) => `https://explorer.test/tx/${h}`,
  isRootValid: vi.fn(),
  isNullifierUsed: vi.fn(),
  submitVerifyAndRegister: vi.fn(),
  submitRegister: vi.fn(),
  verifyProofOffchain: vi.fn(),
}));
vi.mock("@/lib/env", () => ({ env: { ZK_VERIFY_MODE: "onchain", NEXT_PUBLIC_EXPLORER_BASE: "https://explorer.test" } }));
vi.mock("@/lib/db", () => ({
  db: {
    nullifier: { create: vi.fn().mockResolvedValue({}) },
    verification: { create: vi.fn().mockResolvedValue({}) },
  },
}));

import { verifyAndRegister } from "./verification.service";
import * as stellar from "@/lib/stellar";
import { env } from "@/lib/env";

const bundle: ProofBundle = {
  proof: new Uint8Array([1]),
  publicInputs: {
    root: ("0x" + "ab".repeat(32)) as FieldHex,
    scope: ("0x" + "cd".repeat(32)) as FieldHex,
    boundAddress: ("0x" + "ef".repeat(32)) as FieldHex,
    nullifier: ("0x" + "12".repeat(32)) as FieldHex,
    disclosed: ("0x" + "34".repeat(32)) as FieldHex,
  },
};

beforeEach(() => vi.clearAllMocks());

describe("verifyAndRegister", () => {
  it("UNKNOWN_ROOT when root not in valid history (fast fail, no submit)", async () => {
    vi.mocked(stellar.isRootValid).mockResolvedValue(false);
    const r = await verifyAndRegister(bundle);
    expect(r).toMatchObject({ ok: false, result: "UNKNOWN_ROOT" });
    expect(stellar.submitVerifyAndRegister).not.toHaveBeenCalled();
  });

  it("NULLIFIER_USED on the pre-check (mirror already has it)", async () => {
    vi.mocked(stellar.isRootValid).mockResolvedValue(true);
    vi.mocked(stellar.isNullifierUsed).mockResolvedValue(true);
    const r = await verifyAndRegister(bundle);
    expect(r).toMatchObject({ ok: false, result: "NULLIFIER_USED" });
    expect(stellar.submitVerifyAndRegister).not.toHaveBeenCalled();
  });

  it("VERIFIED on Path A success → mirrors + returns txHash/explorerUrl", async () => {
    vi.mocked(stellar.isRootValid).mockResolvedValue(true);
    vi.mocked(stellar.isNullifierUsed).mockResolvedValue(false);
    vi.mocked(stellar.submitVerifyAndRegister).mockResolvedValue({ txHash: "TX123" });
    const r = await verifyAndRegister(bundle);
    expect(r).toEqual({ ok: true, result: "VERIFIED", txHash: "TX123", explorerUrl: "https://explorer.test/tx/TX123" });
  });

  it("NULLIFIER_USED when the contract reverts (Sybil block at submit)", async () => {
    vi.mocked(stellar.isRootValid).mockResolvedValue(true);
    vi.mocked(stellar.isNullifierUsed).mockResolvedValue(false);
    vi.mocked(stellar.submitVerifyAndRegister).mockRejectedValue(new stellar.ContractError("NullifierUsed"));
    const r = await verifyAndRegister(bundle);
    expect(r).toMatchObject({ ok: false, result: "NULLIFIER_USED" });
  });

  it("INVALID_PROOF when the contract reports an invalid proof", async () => {
    vi.mocked(stellar.isRootValid).mockResolvedValue(true);
    vi.mocked(stellar.isNullifierUsed).mockResolvedValue(false);
    vi.mocked(stellar.submitVerifyAndRegister).mockRejectedValue(new stellar.ContractError("InvalidProof"));
    const r = await verifyAndRegister(bundle);
    expect(r).toMatchObject({ ok: false, result: "INVALID_PROOF" });
  });

  it("Path B: verifies off-chain then registers", async () => {
    (env as { ZK_VERIFY_MODE: string }).ZK_VERIFY_MODE = "server";
    vi.mocked(stellar.isRootValid).mockResolvedValue(true);
    vi.mocked(stellar.isNullifierUsed).mockResolvedValue(false);
    vi.mocked(stellar.verifyProofOffchain).mockResolvedValue(true);
    vi.mocked(stellar.submitRegister).mockResolvedValue({ txHash: "TXB" });
    const r = await verifyAndRegister(bundle);
    expect(stellar.verifyProofOffchain).toHaveBeenCalledOnce();
    expect(r).toMatchObject({ ok: true, result: "VERIFIED", txHash: "TXB" });
    (env as { ZK_VERIFY_MODE: string }).ZK_VERIFY_MODE = "onchain";
  });

  it("Path B: INVALID_PROOF when off-chain verify fails (no register)", async () => {
    (env as { ZK_VERIFY_MODE: string }).ZK_VERIFY_MODE = "server";
    vi.mocked(stellar.isRootValid).mockResolvedValue(true);
    vi.mocked(stellar.isNullifierUsed).mockResolvedValue(false);
    vi.mocked(stellar.verifyProofOffchain).mockResolvedValue(false);
    const r = await verifyAndRegister(bundle);
    expect(r).toMatchObject({ ok: false, result: "INVALID_PROOF" });
    expect(stellar.submitRegister).not.toHaveBeenCalled();
    (env as { ZK_VERIFY_MODE: string }).ZK_VERIFY_MODE = "onchain";
  });

  it("ERROR on unexpected failure", async () => {
    vi.mocked(stellar.isRootValid).mockRejectedValue(new Error("rpc down"));
    const r = await verifyAndRegister(bundle);
    expect(r).toMatchObject({ ok: false, result: "ERROR" });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter web test verification.service`
Expected: FAIL — `Failed to resolve import "./verification.service"`.

- [ ] **Step 4: Write minimal implementation**

```ts
// apps/web/src/server/verification.service.ts
import "server-only";

import type { ProofBundle } from "@zelyo/zk-shared";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  ContractError,
  explorerTxUrl,
  isRootValid,
  isNullifierUsed,
  submitVerifyAndRegister,
  submitRegister,
  verifyProofOffchain,
} from "@/lib/stellar";

export type VerificationResult =
  | "VERIFIED"
  | "INVALID_PROOF"
  | "UNKNOWN_ROOT"
  | "NULLIFIER_USED"
  | "ERROR";

export type VerifyResult = {
  ok: boolean;
  result: VerificationResult;
  txHash?: string;
  explorerUrl?: string;
};

function mapContractError(err: unknown): VerificationResult | null {
  if (err instanceof ContractError) {
    switch (err.contractError) {
      case "NullifierUsed":
        return "NULLIFIER_USED";
      case "UnknownRoot":
        return "UNKNOWN_ROOT";
      case "InvalidProof":
      case "AddressMismatch":
        return "INVALID_PROOF";
    }
  }
  return null;
}

async function mirror(
  bundle: ProofBundle,
  result: VerificationResult,
  txHash?: string,
  explorerUrl?: string,
): Promise<void> {
  const { nullifier, scope, boundAddress, disclosed } = bundle.publicInputs;
  if (result === "VERIFIED" && txHash) {
    await db.nullifier.create({
      data: { nullifierHex: nullifier, scope, boundAddress, txHash },
    });
  }
  await db.verification.create({
    data: {
      nullifierHex: nullifier,
      disclosed: { value: disclosed },
      boundAddress,
      result,
      txHash: txHash ?? null,
      explorerUrl: explorerUrl ?? null,
    },
  });
}

export async function verifyAndRegister(bundle: ProofBundle): Promise<VerifyResult> {
  const { root, nullifier } = bundle.publicInputs;
  const log = logger.child({ op: "verifyAndRegister" });

  try {
    // Fast fail: root must be in the valid set; nullifier must be unused (chain is authoritative,
    // but a cheap mirror/contract pre-check avoids a doomed submission).
    if (!(await isRootValid(root))) {
      await mirror(bundle, "UNKNOWN_ROOT");
      return { ok: false, result: "UNKNOWN_ROOT" };
    }
    if (await isNullifierUsed(nullifier)) {
      await mirror(bundle, "NULLIFIER_USED");
      return { ok: false, result: "NULLIFIER_USED" };
    }

    let txHash: string;
    try {
      if (env.ZK_VERIFY_MODE === "server") {
        // Path B: verify the proof off-chain, then register the server-attested result.
        if (!(await verifyProofOffchain(bundle))) {
          await mirror(bundle, "INVALID_PROOF");
          return { ok: false, result: "INVALID_PROOF" };
        }
        ({ txHash } = await submitRegister(bundle.publicInputs));
      } else {
        // Path A: contract verifies the proof on-chain then enforces the checks.
        ({ txHash } = await submitVerifyAndRegister(bundle));
      }
    } catch (err) {
      const mapped = mapContractError(err);
      if (mapped) {
        await mirror(bundle, mapped);
        return { ok: false, result: mapped };
      }
      throw err;
    }

    const explorerUrl = explorerTxUrl(txHash);
    await mirror(bundle, "VERIFIED", txHash, explorerUrl);
    return { ok: true, result: "VERIFIED", txHash, explorerUrl };
  } catch (err) {
    log.error({ err }, "verifyAndRegister failed");
    return { ok: false, result: "ERROR" };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter web test verification.service`
Expected: PASS (9 tests, one per branch incl. both paths).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/server/verification.service.ts apps/web/src/server/verification.service.test.ts apps/web/src/lib/stellar.ts
git commit -m "feat(verify): verifyAndRegister service with Path A/B + Sybil revert mapping"
```

---

### Task 4: Holder credential APIs (`/api/holder/*`)

Three holder-scoped endpoints. All re-check `HOLDER` role + ownership in the handler.

**Files:**
- Create: `apps/web/src/app/api/holder/credentials/route.ts`
- Create: `apps/web/src/app/api/holder/credentials/[id]/vc/route.ts`
- Create: `apps/web/src/app/api/holder/commitment/route.ts`
- Test: `apps/web/src/app/api/holder/holder-api.test.ts`

**Interfaces:**
- Consumes:
  - `src/lib/auth.ts` (Phase 3): `auth(): Promise<Session | null>` with `session.user.id`, `session.user.role`.
  - `src/server/merkle.service.ts` (Phase 4): `getMerkleProof(leafIndex): Promise<{ siblings: FieldHex[]; pathIndices: number[]; rootHex: FieldHex }>`.
  - `src/lib/storage.ts` (Phase 3): `getSignedVcUrl(key: string): Promise<string>`.
  - `src/lib/errors.ts`: `AppError`, `toErrorResponse(err): Response`.
  - Prisma models `HolderKey`, `Credential`, `Leaf`.
- Produces:
  - `GET /api/holder/credentials` → `{ credentials: Array<{ id; status; attributes; leafIndex; merkleRootHex; merklePath: { siblings; pathIndices }; root: FieldHex }> }`.
  - `GET /api/holder/credentials/[id]/vc` → `{ url: string }` (short-lived signed URL).
  - `PUT /api/holder/commitment` body `{ idCommitment: FieldHex }` → `{ idCommitment }`; **rejects** any payload containing `s`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/app/api/holder/holder-api.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const session = { user: { id: "u1", role: "HOLDER" } };
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => session) }));
vi.mock("@/server/merkle.service", () => ({
  getMerkleProof: vi.fn(async () => ({ siblings: ["0xaa"], pathIndices: [0], rootHex: "0xroot" })),
}));
vi.mock("@/lib/storage", () => ({ getSignedVcUrl: vi.fn(async () => "https://signed/vc.json") }));
vi.mock("@/lib/db", () => ({
  db: {
    holderKey: { findUnique: vi.fn(), upsert: vi.fn() },
    credential: { findMany: vi.fn(), findFirst: vi.fn() },
  },
}));

import { GET as listCreds } from "./credentials/route";
import { GET as getVc } from "./credentials/[id]/vc/route";
import { PUT as putCommitment } from "./commitment/route";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

beforeEach(() => vi.clearAllMocks());

describe("holder APIs", () => {
  it("GET /credentials returns the caller's credentials with merkle path + root", async () => {
    vi.mocked(db.holderKey.findUnique).mockResolvedValue({ id: "hk1" } as never);
    vi.mocked(db.credential.findMany).mockResolvedValue([
      { id: "c1", status: "ACTIVE", attributes: { track: "Data Engineering" }, leafIndex: 3, merkleRootHex: "0xroot" },
    ] as never);
    const res = await listCreds(new Request("http://x/api/holder/credentials"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.credentials[0]).toMatchObject({
      id: "c1",
      leafIndex: 3,
      root: "0xroot",
      merklePath: { siblings: ["0xaa"], pathIndices: [0] },
    });
  });

  it("GET /credentials is 401 for unauthenticated callers", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);
    const res = await listCreds(new Request("http://x"));
    expect(res.status).toBe(401);
  });

  it("GET vc returns a signed URL only for the owner", async () => {
    vi.mocked(db.holderKey.findUnique).mockResolvedValue({ id: "hk1" } as never);
    vi.mocked(db.credential.findFirst).mockResolvedValue({ id: "c1", vcFileKey: "vc/c1.json", holderKeyId: "hk1" } as never);
    const res = await getVc(new Request("http://x"), { params: Promise.resolve({ id: "c1" }) });
    expect(res.status).toBe(200);
    expect((await res.json()).url).toBe("https://signed/vc.json");
  });

  it("GET vc is 404 when the credential is not the caller's", async () => {
    vi.mocked(db.holderKey.findUnique).mockResolvedValue({ id: "hk1" } as never);
    vi.mocked(db.credential.findFirst).mockResolvedValue(null as never);
    const res = await getVc(new Request("http://x"), { params: Promise.resolve({ id: "c1" }) });
    expect(res.status).toBe(404);
  });

  it("PUT commitment upserts idCommitment", async () => {
    vi.mocked(db.holderKey.upsert).mockResolvedValue({ idCommitment: "0x" + "ab".repeat(32) } as never);
    const c = "0x" + "ab".repeat(32);
    const res = await putCommitment(new Request("http://x", { method: "PUT", body: JSON.stringify({ idCommitment: c }) }));
    expect(res.status).toBe(200);
    expect((await res.json()).idCommitment).toBe(c);
  });

  it("PUT commitment rejects a payload that contains the secret s", async () => {
    const res = await putCommitment(
      new Request("http://x", { method: "PUT", body: JSON.stringify({ idCommitment: "0x" + "ab".repeat(32), s: "0xdead" }) }),
    );
    expect(res.status).toBe(400);
    expect(db.holderKey.upsert).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test holder-api`
Expected: FAIL — route modules not found.

- [ ] **Step 3: Write minimal implementations**

```ts
// apps/web/src/app/api/holder/credentials/route.ts
import "server-only";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMerkleProof } from "@/server/merkle.service";
import { AppError, toErrorResponse } from "@/lib/errors";

export async function GET(_req: Request): Promise<Response> {
  try {
    const session = await auth();
    if (!session || session.user.role !== "HOLDER") {
      throw new AppError("UNAUTHORIZED", 401, "Sign in as a holder.");
    }
    const holderKey = await db.holderKey.findUnique({ where: { userId: session.user.id } });
    if (!holderKey) return Response.json({ credentials: [] });

    const rows = await db.credential.findMany({
      where: { holderKeyId: holderKey.id },
      orderBy: { createdAt: "desc" },
    });

    const credentials = await Promise.all(
      rows.map(async (c) => {
        const proof = await getMerkleProof(c.leafIndex);
        return {
          id: c.id,
          status: c.status,
          attributes: c.attributes,
          leafIndex: c.leafIndex,
          merkleRootHex: c.merkleRootHex,
          root: proof.rootHex,
          merklePath: { siblings: proof.siblings, pathIndices: proof.pathIndices },
        };
      }),
    );
    return Response.json({ credentials });
  } catch (err) {
    return toErrorResponse(err);
  }
}
```

```ts
// apps/web/src/app/api/holder/credentials/[id]/vc/route.ts
import "server-only";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSignedVcUrl } from "@/lib/storage";
import { AppError, toErrorResponse } from "@/lib/errors";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const session = await auth();
    if (!session || session.user.role !== "HOLDER") {
      throw new AppError("UNAUTHORIZED", 401, "Sign in as a holder.");
    }
    const { id } = await params;
    const holderKey = await db.holderKey.findUnique({ where: { userId: session.user.id } });
    if (!holderKey) throw new AppError("NOT_FOUND", 404, "Credential not found.");

    const cred = await db.credential.findFirst({ where: { id, holderKeyId: holderKey.id } });
    if (!cred) throw new AppError("NOT_FOUND", 404, "Credential not found.");

    const url = await getSignedVcUrl(cred.vcFileKey);
    return Response.json({ url });
  } catch (err) {
    return toErrorResponse(err);
  }
}
```

```ts
// apps/web/src/app/api/holder/commitment/route.ts
import "server-only";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppError, toErrorResponse } from "@/lib/errors";

// Strict so the server rejects any payload containing the secret `s` (or anything extra).
const bodySchema = z
  .object({ idCommitment: z.string().regex(/^0x[0-9a-f]{64}$/) })
  .strict();

export async function PUT(req: Request): Promise<Response> {
  try {
    const session = await auth();
    if (!session || session.user.role !== "HOLDER") {
      throw new AppError("UNAUTHORIZED", 401, "Sign in as a holder.");
    }
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new AppError("INVALID_INPUT", 400, "A valid idCommitment is required.");
    }
    const row = await db.holderKey.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, idCommitment: parsed.data.idCommitment },
      update: { idCommitment: parsed.data.idCommitment },
    });
    return Response.json({ idCommitment: row.idCommitment });
  } catch (err) {
    return toErrorResponse(err);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test holder-api`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/holder
git commit -m "feat(api): holder credentials + signed VC + commitment endpoints (s-rejecting strict schema)"
```

---

### Task 5: Public verify APIs (`/api/verify`, `/api/verify/[txHash]`)

`POST /api/verify` Zod-validates `{ proof, publicInputs }`, rate-limits 20/min per IP, rejects any payload containing `s`, calls `verifyAndRegister`. `GET /api/verify/[txHash]` returns the mirrored verification record.

**Files:**
- Create: `apps/web/src/app/api/verify/route.ts`
- Create: `apps/web/src/app/api/verify/[txHash]/route.ts`
- Test: `apps/web/src/app/api/verify/verify-api.test.ts`

**Interfaces:**
- Consumes:
  - `src/server/verification.service.ts` (Task 3): `verifyAndRegister(bundle): Promise<VerifyResult>`.
  - `src/lib/rate-limit.ts` (Phase 3): `consume(key: string, points: number, ...): Promise<{ allowed: boolean; retryAfter?: number }>` or `consumeOrThrow(bucket: "verify", ip: string): Promise<void>` (throws `AppError("RATE_LIMITED", 429, ...)` with `retryAfter`).
  - `src/lib/errors.ts`: `AppError`, `toErrorResponse`.
  - Prisma `Verification`.
- Produces:
  - `POST /api/verify` body `{ proof: number[]; publicInputs: { root, scope, boundAddress, nullifier, disclosed } }` (each a `0x…64` hex) → `VerifyResult`. `proof` arrives as a JSON number array and is rebuilt into a `Uint8Array`.
  - `GET /api/verify/[txHash]` → `{ result, nullifierHex, disclosed, boundAddress, txHash, explorerUrl } | { error }` (404 if unknown).

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/app/api/verify/verify-api.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/server/verification.service", () => ({ verifyAndRegister: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ consumeOrThrow: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { verification: { findFirst: vi.fn() } } }));

import { POST as verify } from "./route";
import { GET as getVerify } from "./[txHash]/route";
import { verifyAndRegister } from "@/server/verification.service";
import { consumeOrThrow } from "@/lib/rate-limit";
import { db } from "@/lib/db";

const hex = (n: string) => "0x" + n.repeat(32);
const validBody = {
  proof: [1, 2, 3],
  publicInputs: {
    root: hex("ab"), scope: hex("cd"), boundAddress: hex("ef"),
    nullifier: hex("12"), disclosed: hex("34"),
  },
};
const post = (body: unknown) =>
  new Request("http://x/api/verify", { method: "POST", headers: { "x-forwarded-for": "1.1.1.1" }, body: JSON.stringify(body) });

beforeEach(() => vi.clearAllMocks());

describe("POST /api/verify", () => {
  it("validates, rate-limits, and returns the VerifyResult", async () => {
    vi.mocked(verifyAndRegister).mockResolvedValue({ ok: true, result: "VERIFIED", txHash: "TX", explorerUrl: "u" });
    const res = await verify(post(validBody));
    expect(consumeOrThrow).toHaveBeenCalledWith("verify", "1.1.1.1");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, result: "VERIFIED", txHash: "TX" });
    // proof reconstructed as bytes before reaching the service
    const arg = vi.mocked(verifyAndRegister).mock.calls[0][0];
    expect(arg.proof).toBeInstanceOf(Uint8Array);
  });

  it("400 on malformed public inputs", async () => {
    const res = await verify(post({ proof: [1], publicInputs: { root: "nope" } }));
    expect(res.status).toBe(400);
    expect(verifyAndRegister).not.toHaveBeenCalled();
  });

  it("400 and never calls the service when the payload contains s", async () => {
    const res = await verify(post({ ...validBody, s: "0xdead" }));
    expect(res.status).toBe(400);
    expect(verifyAndRegister).not.toHaveBeenCalled();
  });

  it("propagates a 429 from the rate limiter", async () => {
    vi.mocked(consumeOrThrow).mockRejectedValue(
      Object.assign(new Error("RATE_LIMITED"), { code: "RATE_LIMITED", httpStatus: 429, publicMessage: "Slow down.", retryAfter: 5 }),
    );
    const res = await verify(post(validBody));
    expect(res.status).toBe(429);
  });
});

describe("GET /api/verify/[txHash]", () => {
  it("returns the mirrored verification", async () => {
    vi.mocked(db.verification.findFirst).mockResolvedValue({
      result: "VERIFIED", nullifierHex: hex("12"), disclosed: { value: hex("34") },
      boundAddress: hex("ef"), txHash: "TX", explorerUrl: "u",
    } as never);
    const res = await getVerify(new Request("http://x"), { params: Promise.resolve({ txHash: "TX" }) });
    expect(res.status).toBe(200);
    expect((await res.json()).result).toBe("VERIFIED");
  });

  it("404 when unknown", async () => {
    vi.mocked(db.verification.findFirst).mockResolvedValue(null as never);
    const res = await getVerify(new Request("http://x"), { params: Promise.resolve({ txHash: "NOPE" }) });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test verify-api`
Expected: FAIL — route modules not found.

- [ ] **Step 3: Write minimal implementations**

```ts
// apps/web/src/app/api/verify/route.ts
import "server-only";
import { z } from "zod";
import { verifyAndRegister } from "@/server/verification.service";
import { consumeOrThrow } from "@/lib/rate-limit";
import { AppError, toErrorResponse } from "@/lib/errors";

const fieldHex = z.string().regex(/^0x[0-9a-f]{64}$/);

// `.strict()` everywhere so a payload carrying `s` (or any extra key) is rejected — the secret
// must never reach the server.
const bodySchema = z
  .object({
    proof: z.array(z.number().int().min(0).max(255)).max(2_000_000),
    publicInputs: z
      .object({
        root: fieldHex,
        scope: fieldHex,
        boundAddress: fieldHex,
        nullifier: fieldHex,
        disclosed: fieldHex,
      })
      .strict(),
  })
  .strict();

function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown";
}

export async function POST(req: Request): Promise<Response> {
  try {
    await consumeOrThrow("verify", clientIp(req));

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new AppError("INVALID_INPUT", 400, "Invalid proof payload.");
    }

    const result = await verifyAndRegister({
      proof: Uint8Array.from(parsed.data.proof),
      publicInputs: parsed.data.publicInputs as never,
    });
    return Response.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
```

```ts
// apps/web/src/app/api/verify/[txHash]/route.ts
import "server-only";
import { db } from "@/lib/db";
import { AppError, toErrorResponse } from "@/lib/errors";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ txHash: string }> },
): Promise<Response> {
  try {
    const { txHash } = await params;
    const row = await db.verification.findFirst({
      where: { txHash },
      orderBy: { createdAt: "desc" },
    });
    if (!row) throw new AppError("NOT_FOUND", 404, "No verification for that transaction.");
    return Response.json({
      result: row.result,
      nullifierHex: row.nullifierHex,
      disclosed: row.disclosed,
      boundAddress: row.boundAddress,
      txHash: row.txHash,
      explorerUrl: row.explorerUrl,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test verify-api`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/verify
git commit -m "feat(api): public POST /api/verify (Zod, 20/min, s-rejecting) + GET /api/verify/[txHash]"
```

---

### Task 6: Prove panel client component (`ProvePanel`)

The interactive heart of `/wallet/prove/[id]`: selective-disclosure toggles (default reveals only `track`, hides name/grade), Stellar address binding, the foil-stamp "Generate ZK-Proof" CTA, a typewriter prove log, in-browser proving via `proveCredential`, `POST /api/verify`, then route to `/verify/result/[txHash]`.

**Files:**
- Create: `apps/web/src/components/wallet/ProvePanel.tsx`
- Test: `apps/web/src/components/wallet/ProvePanel.test.tsx`

**Interfaces:**
- Consumes:
  - Task 1: `loadHolderSecret(passphrase): Promise<FieldHex | null>`.
  - Task 2: `proveCredential(input: ProveInput): Promise<ProofBundle>`, `ProverError`.
  - zk-shared: `type Attributes`, `type FieldHex`, `type ProofBundle`.
  - Phase 3 components: `FoilStampButton`, `TypewriterLog` (`appendLine(line: string)` via ref or controlled `lines` prop), `LedgerPanel`, `DisclosureCheckbox`.
  - `useRouter` from `next/navigation`.
  - Props: `{ credential: { id: string; attributes: Attributes; leafIndex: number; merklePath: { siblings: FieldHex[]; pathIndices: number[] }; root: FieldHex } }`.
- Produces (used by Task 8): the `ProvePanel` component.

- [ ] **Step 1: Add testing-library deps if not present**

Run: `pnpm --filter web add -D @testing-library/react @testing-library/user-event @testing-library/jest-dom`
Ensure `apps/web/vitest.setup.ts` includes `import "@testing-library/jest-dom/vitest";`.

- [ ] **Step 2: Write the failing test**

```tsx
// apps/web/src/components/wallet/ProvePanel.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FieldHex } from "@zelyo/zk-shared";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/holder-key.client", () => ({ loadHolderSecret: vi.fn() }));
vi.mock("@/lib/prover.client", () => ({
  proveCredential: vi.fn(),
  ProverError: class ProverError extends Error { constructor(public code: string) { super(code); } },
}));

import { ProvePanel } from "./ProvePanel";
import { loadHolderSecret } from "@/lib/holder-key.client";
import { proveCredential } from "@/lib/prover.client";

const credential = {
  id: "c1",
  attributes: { track: "Data Engineering", grade: "A", issueDate: "2026-01-01", courseName: "DS", learnerName: "Ada" },
  leafIndex: 3,
  merklePath: { siblings: [("0x" + "00".repeat(32)) as FieldHex], pathIndices: [0] },
  root: ("0x" + "ab".repeat(32)) as FieldHex,
};
const ADDR = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});

describe("ProvePanel", () => {
  it("defaults to disclosing only track; name and grade hidden by default", () => {
    render(<ProvePanel credential={credential} />);
    expect((screen.getByLabelText(/track/i) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText(/learner name/i) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText(/grade/i) as HTMLInputElement).checked).toBe(false);
  });

  it("proves in-browser then POSTs /api/verify and routes to the result", async () => {
    vi.mocked(loadHolderSecret).mockResolvedValue(("0x" + "11".repeat(32)) as FieldHex);
    vi.mocked(proveCredential).mockResolvedValue({
      proof: new Uint8Array([7, 8, 9]),
      publicInputs: {
        root: credential.root, scope: ("0x" + "cd".repeat(32)) as FieldHex,
        boundAddress: ("0x" + "ef".repeat(32)) as FieldHex,
        nullifier: ("0x" + "12".repeat(32)) as FieldHex, disclosed: ("0x" + "34".repeat(32)) as FieldHex,
      },
    });
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true, result: "VERIFIED", txHash: "TX123" }), { status: 200 }),
    );
    const user = userEvent.setup();
    render(<ProvePanel credential={credential} />);
    await user.type(screen.getByLabelText(/stellar address/i), ADDR);
    await user.type(screen.getByLabelText(/passphrase/i), "pass");
    await user.click(screen.getByRole("button", { name: /generate zk-proof/i }));

    await waitFor(() => expect(proveCredential).toHaveBeenCalledOnce());
    // proof bytes are serialized as a number array; s is never in the request body
    const body = JSON.parse(vi.mocked(global.fetch).mock.calls[0][1]!.body as string);
    expect(Array.isArray(body.proof)).toBe(true);
    expect(JSON.stringify(body)).not.toContain("11".repeat(32));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/verify/result/TX123"));
  });

  it("shows the Sybil rejection inline when result is NULLIFIER_USED", async () => {
    vi.mocked(loadHolderSecret).mockResolvedValue(("0x" + "11".repeat(32)) as FieldHex);
    vi.mocked(proveCredential).mockResolvedValue({
      proof: new Uint8Array(),
      publicInputs: { root: credential.root, scope: "0x0" as FieldHex, boundAddress: "0x0" as FieldHex, nullifier: "0x0" as FieldHex, disclosed: "0x0" as FieldHex },
    });
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: false, result: "NULLIFIER_USED" }), { status: 200 }),
    );
    const user = userEvent.setup();
    render(<ProvePanel credential={credential} />);
    await user.type(screen.getByLabelText(/stellar address/i), ADDR);
    await user.type(screen.getByLabelText(/passphrase/i), "pass");
    await user.click(screen.getByRole("button", { name: /generate zk-proof/i }));
    await waitFor(() => expect(screen.getByText(/already been used/i)).toBeInTheDocument());
    expect(push).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter web test ProvePanel`
Expected: FAIL — `Failed to resolve import "./ProvePanel"`.

- [ ] **Step 4: Write minimal implementation**

```tsx
// apps/web/src/components/wallet/ProvePanel.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Attributes, FieldHex, ProofBundle } from "@zelyo/zk-shared";
import { loadHolderSecret } from "@/lib/holder-key.client";
import { proveCredential, ProverError } from "@/lib/prover.client";
import { FoilStampButton } from "@/components/FoilStampButton";
import { TypewriterLog } from "@/components/TypewriterLog";
import { LedgerPanel } from "@/components/LedgerPanel";

export interface ProvePanelCredential {
  id: string;
  attributes: Attributes;
  leafIndex: number;
  merklePath: { siblings: FieldHex[]; pathIndices: number[] };
  root: FieldHex;
}

const DISCLOSABLE: { key: keyof Attributes; label: string; locked?: boolean }[] = [
  { key: "track", label: "Track" },
  { key: "courseName", label: "Course Name" },
  { key: "issueDate", label: "Issue Date" },
  { key: "grade", label: "Grade" },
  { key: "learnerName", label: "Learner Name" },
];

const RESULT_COPY: Record<string, string> = {
  NULLIFIER_USED: "This credential has already been used to prove this fact. Each holder may register once.",
  INVALID_PROOF: "The proof could not be verified. Please regenerate it.",
  UNKNOWN_ROOT: "The issuing root is no longer recognised by the registry.",
  ERROR: "The verification could not be completed. Please try again.",
};

export function ProvePanel({ credential }: { credential: ProvePanelCredential }) {
  const router = useRouter();
  // Default: reveal only `track`; name/grade hidden.
  const [disclose, setDisclose] = useState<Record<string, boolean>>({ track: true });
  const [address, setAddress] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [lines, setLines] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const log = (event: string, status = "OK") => {
    const ts = new Date().toISOString().slice(11, 19);
    setLines((prev) => [...prev, `[${ts}] ${event} … ${status}`]);
  };

  const toggle = (key: string) =>
    setDisclose((prev) => ({ ...prev, [key]: !prev[key] }));

  async function onGenerate() {
    setError(null);
    setBusy(true);
    try {
      log("UNSEALING IDENTITY SECRET");
      const s = await loadHolderSecret(passphrase);
      if (!s) {
        setError("No holder secret found in this browser. Restore it on the Keys page first.");
        return;
      }
      log("WITNESS + PROOF (UltraHonk)", "RUNNING");
      const bundle: ProofBundle = await proveCredential({
        s,
        attributes: credential.attributes,
        disclose: { track: disclose.track === true },
        merklePath: credential.merklePath,
        root: credential.root,
        boundStellarAddress: address,
      });
      log("PROOF GENERATED");

      log("SUBMITTING TO REGISTRY");
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          proof: Array.from(bundle.proof),
          publicInputs: bundle.publicInputs,
        }),
      });
      const result = (await res.json()) as { ok: boolean; result: string; txHash?: string };

      if (result.ok && result.txHash) {
        log("SEALED ON-CHAIN", result.txHash.slice(0, 10));
        router.push(`/verify/result/${result.txHash}`);
      } else {
        log("REGISTRY REJECTED", result.result);
        setError(RESULT_COPY[result.result] ?? RESULT_COPY.ERROR);
      }
    } catch (err) {
      if (err instanceof ProverError && err.code === "NOT_ISOLATED") {
        setError("Secure proving is unavailable: this page is not cross-origin isolated.");
      } else {
        setError("Proof generation failed. Please try again.");
      }
      log("ERROR", "FAILED");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-gutter md:grid-cols-2">
      <section>
        <p className="font-label text-label-md uppercase text-secondary">Selective Disclosure</p>
        <p className="mt-stack-sm font-body text-body-md italic text-on-surface-variant">
          Select the attributes you wish to encode into the resulting proof. All other data remains
          strictly private.
        </p>
        <fieldset className="mt-stack-md space-y-stack-sm">
          {DISCLOSABLE.map(({ key, label }) => {
            const checked = disclose[key] === true;
            return (
              <label
                key={key}
                className={`flex items-center gap-stack-sm py-unit ${checked ? "font-semibold text-primary" : "text-on-surface-variant"}`}
              >
                <input
                  type="checkbox"
                  className="text-primary"
                  checked={checked}
                  onChange={() => toggle(key)}
                  aria-label={label}
                />
                {label}
              </label>
            );
          })}
        </fieldset>

        <div className="mt-stack-md">
          <label className="font-label text-label-md uppercase text-secondary" htmlFor="addr">
            Stellar Address
          </label>
          <input
            id="addr"
            aria-label="Stellar Address"
            className="mt-unit w-full border-b border-outline bg-transparent font-mono text-body-md focus:border-primary focus:outline-none"
            placeholder="G…"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>

        <div className="mt-stack-md">
          <label className="font-label text-label-md uppercase text-secondary" htmlFor="pass">
            Vault Passphrase
          </label>
          <input
            id="pass"
            aria-label="Passphrase"
            type="password"
            className="mt-unit w-full border-b border-outline bg-transparent text-body-md focus:border-primary focus:outline-none"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
          />
        </div>

        {error && (
          <p role="alert" className="mt-stack-md font-body text-body-md text-error">
            {error}
          </p>
        )}

        <FoilStampButton
          className="mt-stack-lg"
          disabled={busy || !address || !passphrase}
          onClick={onGenerate}
        >
          {busy ? "Sealing…" : "Generate ZK-Proof"}
        </FoilStampButton>
      </section>

      <LedgerPanel>
        <TypewriterLog lines={lines} />
      </LedgerPanel>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter web test ProvePanel`
Expected: PASS (3 tests). If `FoilStampButton`/`TypewriterLog`/`LedgerPanel` from Phase 3 expose different prop names, adapt the imports/props to match the Phase 3 components (do not redefine them).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/wallet/ProvePanel.tsx apps/web/src/components/wallet/ProvePanel.test.tsx apps/web/package.json
git commit -m "feat(wallet): ProvePanel — selective disclosure, address binding, in-browser prove + verify"
```

---

### Task 7: `/wallet` and `/wallet/credentials/[id]` pages

`/wallet` shows credential cards (status, course, issuer, date, signature hash) + recent history; the detail page adds raw VC download. BRAND-styled registry framing, Server Components fetching server-side, with a small client download button.

**Files:**
- Create: `apps/web/src/app/wallet/page.tsx`
- Create: `apps/web/src/app/wallet/credentials/[id]/page.tsx`
- Create: `apps/web/src/components/wallet/CredentialCard.tsx`
- Create: `apps/web/src/components/wallet/VcDownloadButton.tsx`
- Test: `apps/web/src/components/wallet/CredentialCard.test.tsx`

**Interfaces:**
- Consumes:
  - `src/lib/auth.ts`: `auth()`.
  - `src/lib/db.ts`: `HolderKey`, `Credential`, `Issuer`, `Verification`.
  - Task 4 API `GET /api/holder/credentials/[id]/vc` (used by `VcDownloadButton`).
  - Phase 3 components: `RegistryCard` framing, `StatusPill`.
- Produces: `CredentialCard` (`{ credential, signatureHash }`), `VcDownloadButton` (`{ credentialId }`), the two pages.

- [ ] **Step 1: Write the failing test (the presentational card)**

```tsx
// apps/web/src/components/wallet/CredentialCard.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CredentialCard } from "./CredentialCard";

describe("CredentialCard", () => {
  const credential = {
    id: "c1",
    status: "ACTIVE" as const,
    issuerName: "Institute of Distributed Systems",
    attributes: { courseName: "Distributed Systems", track: "Data Engineering", issueDate: "2026-01-01", grade: "A", learnerName: "Ada" },
    leafIndex: 882,
  };

  it("renders course, issuer, date, status, and a truncated signature hash; hides grade/name", () => {
    render(<CredentialCard credential={credential} signatureHash={"0x" + "ab".repeat(32)} />);
    expect(screen.getByText(/Distributed Systems/)).toBeInTheDocument();
    expect(screen.getByText(/Institute of Distributed Systems/)).toBeInTheDocument();
    expect(screen.getByText(/2026-01-01/)).toBeInTheDocument();
    expect(screen.getByText(/ACTIVE/i)).toBeInTheDocument();
    expect(screen.getByText(/Identity Folio No\. 882/)).toBeInTheDocument();
    // signature hash is shown truncated (machine voice)
    expect(screen.getByText(/0xabababab/)).toBeInTheDocument();
    // PII is NOT rendered on the card
    expect(screen.queryByText("A")).not.toBeInTheDocument();
    expect(screen.queryByText("Ada")).not.toBeInTheDocument();
  });

  it("links to the credential detail and the prove flow", () => {
    render(<CredentialCard credential={credential} signatureHash={"0x" + "ab".repeat(32)} />);
    expect(screen.getByRole("link", { name: /view/i })).toHaveAttribute("href", "/wallet/credentials/c1");
    expect(screen.getByRole("link", { name: /prove/i })).toHaveAttribute("href", "/wallet/prove/c1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test CredentialCard`
Expected: FAIL — `Failed to resolve import "./CredentialCard"`.

- [ ] **Step 3: Write minimal implementations**

```tsx
// apps/web/src/components/wallet/CredentialCard.tsx
import Link from "next/link";

export interface CredentialCardModel {
  id: string;
  status: "ACTIVE" | "REVOKED";
  issuerName: string;
  attributes: { courseName: string; track: string; issueDate: string; grade: string; learnerName: string };
  leafIndex: number;
}

export function CredentialCard({
  credential,
  signatureHash,
}: {
  credential: CredentialCardModel;
  signatureHash: string;
}) {
  // Only non-PII fields are rendered: course, track, issuer, date, status, signature hash.
  return (
    <article className="manuscript-glow relative border-l border-primary border border-outline-variant rounded-lg bg-surface-container-lowest p-stack-lg">
      <p className="font-label text-caption uppercase tracking-wider text-secondary">
        Identity Folio No. {credential.leafIndex}
      </p>
      <h3 className="mt-unit font-headline text-headline-md text-primary">
        {credential.attributes.courseName}
      </h3>
      <dl className="mt-stack-md space-y-unit font-body text-body-md text-on-surface-variant">
        <div className="flex justify-between">
          <dt className="font-label text-label-md uppercase text-secondary">Track</dt>
          <dd>{credential.attributes.track}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-label text-label-md uppercase text-secondary">Issuer</dt>
          <dd>{credential.issuerName}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-label text-label-md uppercase text-secondary">Issued</dt>
          <dd>{credential.attributes.issueDate}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-label text-label-md uppercase text-secondary">Signature</dt>
          <dd className="typewriter">{signatureHash.slice(0, 10)}…</dd>
        </div>
      </dl>
      <p className="mt-stack-md font-label text-label-md uppercase text-primary">
        Status: {credential.status}
      </p>
      <div className="mt-stack-lg flex gap-gutter">
        <Link className="font-label text-label-md uppercase text-primary underline" href={`/wallet/credentials/${credential.id}`}>
          View
        </Link>
        <Link className="font-label text-label-md uppercase text-primary underline" href={`/wallet/prove/${credential.id}`}>
          Prove
        </Link>
      </div>
    </article>
  );
}
```

```tsx
// apps/web/src/components/wallet/VcDownloadButton.tsx
"use client";

import { useState } from "react";

export function VcDownloadButton({ credentialId }: { credentialId: string }) {
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    try {
      const res = await fetch(`/api/holder/credentials/${credentialId}/vc`);
      if (!res.ok) return;
      const { url } = (await res.json()) as { url: string };
      window.open(url, "_blank", "noopener");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={download}
      disabled={busy}
      className="border border-outline rounded font-label text-label-md uppercase text-primary px-stack-md py-stack-sm hover:bg-secondary-container"
    >
      {busy ? "Preparing…" : "Download Raw VC"}
    </button>
  );
}
```

```tsx
// apps/web/src/app/wallet/page.tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { CredentialCard } from "@/components/wallet/CredentialCard";

export default async function WalletPage() {
  const session = await auth();
  if (!session || session.user.role !== "HOLDER") redirect("/login");

  const holderKey = await db.holderKey.findUnique({ where: { userId: session.user.id } });
  const credentials = holderKey
    ? await db.credential.findMany({
        where: { holderKeyId: holderKey.id },
        include: { issuer: true, leaf: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <main className="mx-auto max-w-[1120px] px-margin-mobile py-stack-lg md:px-margin-page">
      <h1 className="font-display text-display-lg text-primary">My Credentials</h1>
      <p className="mt-stack-sm font-body text-body-md italic text-on-surface-variant">
        Each entry is sealed in the registry. Personal data never leaves this folio.
      </p>
      {credentials.length === 0 ? (
        <p className="mt-stack-lg font-body text-body-md">No credentials yet.</p>
      ) : (
        <div className="mt-stack-lg grid grid-cols-1 gap-gutter md:grid-cols-2">
          {credentials.map((c) => (
            <CredentialCard
              key={c.id}
              credential={{
                id: c.id,
                status: c.status,
                issuerName: c.issuer.name,
                attributes: c.attributes as never,
                leafIndex: c.leafIndex,
              }}
              signatureHash={c.leaf.leafHex}
            />
          ))}
        </div>
      )}
    </main>
  );
}
```

```tsx
// apps/web/src/app/wallet/credentials/[id]/page.tsx
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { VcDownloadButton } from "@/components/wallet/VcDownloadButton";

export default async function CredentialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session || session.user.role !== "HOLDER") redirect("/login");
  const { id } = await params;

  const holderKey = await db.holderKey.findUnique({ where: { userId: session.user.id } });
  const cred = holderKey
    ? await db.credential.findFirst({
        where: { id, holderKeyId: holderKey.id },
        include: { issuer: true, leaf: true },
      })
    : null;
  if (!cred) notFound();

  const a = cred.attributes as { courseName: string; track: string; issueDate: string };

  return (
    <main className="mx-auto max-w-[1120px] px-margin-mobile py-stack-lg md:px-margin-page">
      <h1 className="font-display text-display-lg text-primary">{a.courseName}</h1>
      <dl className="mt-stack-lg space-y-stack-md font-body text-body-md">
        <div><dt className="font-label text-label-md uppercase text-secondary">Track</dt><dd>{a.track}</dd></div>
        <div><dt className="font-label text-label-md uppercase text-secondary">Issuer</dt><dd>{cred.issuer.name}</dd></div>
        <div><dt className="font-label text-label-md uppercase text-secondary">Issued</dt><dd>{a.issueDate}</dd></div>
        <div><dt className="font-label text-label-md uppercase text-secondary">Root at issuance</dt><dd className="typewriter break-all">{cred.merkleRootHex}</dd></div>
        <div><dt className="font-label text-label-md uppercase text-secondary">Leaf signature</dt><dd className="typewriter break-all">{cred.leaf.leafHex}</dd></div>
      </dl>
      <div className="mt-stack-lg flex gap-gutter">
        <VcDownloadButton credentialId={cred.id} />
        <Link className="font-label text-label-md uppercase text-primary underline self-center" href={`/wallet/prove/${cred.id}`}>
          Prove a fact
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test CredentialCard`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/wallet/page.tsx apps/web/src/app/wallet/credentials apps/web/src/components/wallet/CredentialCard.tsx apps/web/src/components/wallet/CredentialCard.test.tsx apps/web/src/components/wallet/VcDownloadButton.tsx
git commit -m "feat(wallet): credential list + detail pages with raw VC download"
```

---

### Task 8: `/wallet/prove/[id]` page

Server Component that authorizes the holder, loads the credential + merkle path, and renders `ProvePanel`. One foil-stamp CTA per view (inside the panel).

**Files:**
- Create: `apps/web/src/app/wallet/prove/[id]/page.tsx`
- Test: `apps/web/src/app/wallet/prove/[id]/prove-page.test.tsx`

**Interfaces:**
- Consumes: `auth()`, `db`, `getMerkleProof` (Phase 4), Task 6 `ProvePanel`.
- Produces: the prove page route.

- [ ] **Step 1: Write the failing test (server-component logic via mocks)**

```tsx
// apps/web/src/app/wallet/prove/[id]/prove-page.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/merkle.service", () => ({
  getMerkleProof: vi.fn(async () => ({ siblings: ["0xaa"], pathIndices: [0], rootHex: "0xroot" })),
}));
vi.mock("@/lib/db", () => ({
  db: { holderKey: { findUnique: vi.fn() }, credential: { findFirst: vi.fn() } },
}));
const redirect = vi.fn(() => { throw new Error("REDIRECT"); });
vi.mock("next/navigation", () => ({ redirect, notFound: () => { throw new Error("NOT_FOUND"); } }));
// Render ProvePanel as a stub to keep this test about the page wiring.
vi.mock("@/components/wallet/ProvePanel", () => ({
  ProvePanel: ({ credential }: { credential: { id: string } }) => <div>panel:{credential.id}</div>,
}));

import ProvePage from "./page";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

beforeEach(() => vi.clearAllMocks());

describe("/wallet/prove/[id]", () => {
  it("redirects non-holders to login", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    await expect(ProvePage({ params: Promise.resolve({ id: "c1" }) })).rejects.toThrow("REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("renders ProvePanel with the credential + merkle path for the owner", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1", role: "HOLDER" } } as never);
    vi.mocked(db.holderKey.findUnique).mockResolvedValue({ id: "hk1" } as never);
    vi.mocked(db.credential.findFirst).mockResolvedValue({
      id: "c1", attributes: { track: "Data Engineering" }, leafIndex: 3, merkleRootHex: "0xroot",
    } as never);
    const ui = await ProvePage({ params: Promise.resolve({ id: "c1" }) });
    render(ui);
    expect(screen.getByText("panel:c1")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test prove-page`
Expected: FAIL — `Failed to resolve import "./page"`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/src/app/wallet/prove/[id]/page.tsx
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getMerkleProof } from "@/server/merkle.service";
import { ProvePanel } from "@/components/wallet/ProvePanel";

export default async function ProvePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session || session.user.role !== "HOLDER") redirect("/login");
  const { id } = await params;

  const holderKey = await db.holderKey.findUnique({ where: { userId: session.user.id } });
  const cred = holderKey
    ? await db.credential.findFirst({ where: { id, holderKeyId: holderKey.id } })
    : null;
  if (!cred) notFound();

  const proof = await getMerkleProof(cred.leafIndex);

  return (
    <main className="mx-auto max-w-[1120px] px-margin-mobile py-stack-lg md:px-margin-page">
      <h1 className="font-display text-display-lg text-primary">Seal a Proof</h1>
      <p className="mt-stack-sm font-body text-body-md italic text-on-surface-variant">
        Cryptographically sealed via the Zelyo Protocol — nothing personal leaves this device.
      </p>
      <div className="mt-stack-lg">
        <ProvePanel
          credential={{
            id: cred.id,
            attributes: cred.attributes as never,
            leafIndex: cred.leafIndex,
            merklePath: { siblings: proof.siblings, pathIndices: proof.pathIndices },
            root: proof.rootHex,
          }}
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test prove-page`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/wallet/prove/[id]"
git commit -m "feat(wallet): /wallet/prove/[id] page wiring ProvePanel with merkle path"
```

---

### Task 9: `/wallet/keys` page + `KeysManager`

Shows the holder's public `idCommitment`; lets them generate, back up, and restore the secret `s` client-side only, and `PUT /api/holder/commitment` (only the commitment is ever sent).

**Files:**
- Create: `apps/web/src/components/wallet/KeysManager.tsx`
- Create: `apps/web/src/app/wallet/keys/page.tsx`
- Test: `apps/web/src/components/wallet/KeysManager.test.tsx`

**Interfaces:**
- Consumes (Task 1): `generateHolderSecret`, `persistHolderSecret`, `loadHolderSecret`, `hasHolderSecret`, `exportBackup`, `restoreBackup`, `deriveIdCommitment`.
- Produces: `KeysManager` component, the keys page.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/wallet/KeysManager.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FieldHex } from "@zelyo/zk-shared";

vi.mock("@/lib/holder-key.client", () => ({
  generateHolderSecret: vi.fn(),
  persistHolderSecret: vi.fn(async () => {}),
  loadHolderSecret: vi.fn(),
  hasHolderSecret: vi.fn(async () => false),
  exportBackup: vi.fn(async () => '{"kind":"zelyo-holder-backup"}'),
  restoreBackup: vi.fn(),
  deriveIdCommitment: vi.fn(),
}));

import { KeysManager } from "./KeysManager";
import * as keys from "@/lib/holder-key.client";

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn(async () => new Response("{}", { status: 200 })) as never;
});

describe("KeysManager", () => {
  it("generates s, derives the commitment, persists it, and PUTs only the commitment (never s)", async () => {
    const s = ("0x" + "11".repeat(32)) as FieldHex;
    const commitment = ("0x" + "22".repeat(32)) as FieldHex;
    vi.mocked(keys.generateHolderSecret).mockResolvedValue(s);
    vi.mocked(keys.deriveIdCommitment).mockReturnValue(commitment);

    const user = userEvent.setup();
    render(<KeysManager />);
    await user.type(screen.getByLabelText(/passphrase/i), "vault");
    await user.click(screen.getByRole("button", { name: /generate identity/i }));

    await waitFor(() => expect(keys.persistHolderSecret).toHaveBeenCalledWith(s, "vault"));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/holder/commitment", expect.anything()));
    const body = (vi.mocked(global.fetch).mock.calls[0][1] as RequestInit).body as string;
    expect(JSON.parse(body)).toEqual({ idCommitment: commitment });
    expect(body).not.toContain("11".repeat(32)); // s never transmitted
    await waitFor(() => expect(screen.getByText(new RegExp(commitment.slice(0, 10)))).toBeInTheDocument());
  });

  it("restores a backup blob client-side and shows the recovered commitment", async () => {
    const s = ("0x" + "33".repeat(32)) as FieldHex;
    const commitment = ("0x" + "44".repeat(32)) as FieldHex;
    vi.mocked(keys.restoreBackup).mockResolvedValue(s);
    vi.mocked(keys.deriveIdCommitment).mockReturnValue(commitment);

    const user = userEvent.setup();
    render(<KeysManager />);
    await user.type(screen.getByLabelText(/passphrase/i), "vault");
    await user.type(screen.getByLabelText(/backup blob/i), '{"kind":"zelyo-holder-backup"}');
    await user.click(screen.getByRole("button", { name: /restore/i }));
    await waitFor(() => expect(keys.restoreBackup).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(new RegExp(commitment.slice(0, 10)))).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test KeysManager`
Expected: FAIL — `Failed to resolve import "./KeysManager"`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// apps/web/src/components/wallet/KeysManager.tsx
"use client";

import { useState } from "react";
import type { FieldHex } from "@zelyo/zk-shared";
import {
  generateHolderSecret,
  persistHolderSecret,
  exportBackup,
  restoreBackup,
  deriveIdCommitment,
} from "@/lib/holder-key.client";

export function KeysManager() {
  const [passphrase, setPassphrase] = useState("");
  const [blob, setBlob] = useState("");
  const [commitment, setCommitment] = useState<FieldHex | null>(null);
  const [backup, setBackup] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function publishCommitment(c: FieldHex) {
    // Only the public commitment is ever sent to the server; never `s`.
    await fetch("/api/holder/commitment", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idCommitment: c }),
    });
  }

  async function onGenerate() {
    setError(null);
    setBusy(true);
    try {
      const s = await generateHolderSecret();
      const c = deriveIdCommitment(s);
      await persistHolderSecret(s, passphrase);
      await publishCommitment(c);
      setBackup(await exportBackup(s, passphrase));
      setCommitment(c);
    } catch {
      setError("Could not generate the identity. Choose a passphrase and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onRestore() {
    setError(null);
    setBusy(true);
    try {
      const s = await restoreBackup(blob, passphrase);
      const c = deriveIdCommitment(s);
      await persistHolderSecret(s, passphrase);
      await publishCommitment(c);
      setCommitment(c);
    } catch {
      setError("Restore failed: check the backup blob and passphrase.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-stack-lg">
      <div>
        <label className="font-label text-label-md uppercase text-secondary" htmlFor="kpass">
          Vault Passphrase
        </label>
        <input
          id="kpass"
          aria-label="Passphrase"
          type="password"
          className="mt-unit w-full border-b border-outline bg-transparent text-body-md focus:border-primary focus:outline-none"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
        />
        <p className="mt-stack-sm font-body text-caption italic text-on-surface-variant">
          Your secret is sealed locally with this passphrase. It is never sent to Zelyo.
        </p>
      </div>

      {commitment && (
        <p className="font-body text-body-md">
          Public identity commitment:{" "}
          <span className="typewriter break-all text-primary">{commitment}</span>
        </p>
      )}

      {backup && (
        <div>
          <p className="font-label text-label-md uppercase text-secondary">Backup Blob</p>
          <textarea
            readOnly
            aria-label="Backup blob output"
            className="mt-unit w-full border border-outline-variant rounded bg-surface-container-high p-stack-sm typewriter text-caption"
            rows={4}
            value={backup}
          />
        </div>
      )}

      {error && <p role="alert" className="font-body text-body-md text-error">{error}</p>}

      <div className="flex flex-wrap gap-gutter">
        <button
          type="button"
          disabled={busy || !passphrase}
          onClick={onGenerate}
          className="border border-outline rounded font-label text-label-md uppercase text-primary px-stack-md py-stack-sm hover:bg-secondary-container"
        >
          Generate Identity
        </button>
      </div>

      <div>
        <label className="font-label text-label-md uppercase text-secondary" htmlFor="kblob">
          Restore from Backup Blob
        </label>
        <textarea
          id="kblob"
          aria-label="Backup blob"
          className="mt-unit w-full border border-outline-variant rounded bg-transparent p-stack-sm typewriter text-caption"
          rows={4}
          value={blob}
          onChange={(e) => setBlob(e.target.value)}
        />
        <button
          type="button"
          disabled={busy || !passphrase || !blob}
          onClick={onRestore}
          className="mt-stack-sm border border-outline rounded font-label text-label-md uppercase text-primary px-stack-md py-stack-sm hover:bg-secondary-container"
        >
          Restore
        </button>
      </div>
    </div>
  );
}
```

```tsx
// apps/web/src/app/wallet/keys/page.tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { KeysManager } from "@/components/wallet/KeysManager";

export default async function KeysPage() {
  const session = await auth();
  if (!session || session.user.role !== "HOLDER") redirect("/login");

  return (
    <main className="mx-auto max-w-[1120px] px-margin-mobile py-stack-lg md:px-margin-page">
      <h1 className="font-display text-display-lg text-primary">Identity Keys</h1>
      <p className="mt-stack-sm font-body text-body-md italic text-on-surface-variant">
        Your identity secret lives only in this browser. Export a backup to keep it safe — Zelyo
        only ever learns your public commitment.
      </p>
      <div className="mt-stack-lg max-w-[640px]">
        <KeysManager />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test KeysManager`
Expected: PASS (2 tests).

- [ ] **Step 5: Full phase typecheck + lint + tests**

Run: `pnpm --filter web typecheck && pnpm --filter web lint && pnpm --filter web test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/wallet/KeysManager.tsx apps/web/src/components/wallet/KeysManager.test.tsx apps/web/src/app/wallet/keys/page.tsx
git commit -m "feat(wallet): /wallet/keys — client-only generate/backup/restore + commitment publish"
```

---

## Phase Gate

Do not start Phase 6 until every box is checked.

- [ ] `pnpm --filter web typecheck && pnpm --filter web lint && pnpm --filter web test` all pass.
- [ ] **The secret `s` never leaves the browser.** `holder-key.client.ts` and `prover.client.ts` are the only places `s` exists; the `PUT /api/holder/commitment` and `POST /api/verify` schemas are `.strict()` and reject any payload containing `s` (Tasks 4 & 5 tests assert a 400 with no service call); `KeysManager` sends only `idCommitment` (Task 9 test asserts the body contains no `s`).
- [ ] **Proof generates in-browser under COOP/COEP.** `proveCredential` calls `assertCrossOriginIsolated()` first and throws `ProverError("NOT_ISOLATED")` otherwise; the cross-origin-isolation requirement + real-browser test note are documented in `prover.client.ts`; verified in a real browser by the Phase 7 Playwright "selective disclosure" e2e (no WASM in unit tests by design).
- [ ] **Verify returns a txHash.** `verifyAndRegister` returns `{ ok: true, result: "VERIFIED", txHash, explorerUrl }` on success under both Path A and Path B (Task 3 tests), and `POST /api/verify` returns that `VerifyResult` (Task 5 test).
- [ ] **Selective disclosure hides name/grade.** `ProvePanel` defaults `disclose` to `{ track: true }` with `learnerName`/`grade` unchecked (Task 6 test); `CredentialCard` renders no PII (Task 7 test).
- [ ] **Routes to the result.** On `{ ok: true, txHash }` `ProvePanel` calls `router.push("/verify/result/<txHash>")` (Task 6 test); on `NULLIFIER_USED` it surfaces the Sybil rejection inline and does not navigate.
- [ ] No secret/PII logged or shipped to the client; new env keys (none new this phase beyond `ZK_VERIFY_MODE`, `NEXT_PUBLIC_EXPLORER_BASE` from Phase 0/3) present in `.env.example` + `env.ts`; pages visibly match `BRAND.md` (foil-stamp CTA, typewriter log, ledger framing, one CTA per view).
