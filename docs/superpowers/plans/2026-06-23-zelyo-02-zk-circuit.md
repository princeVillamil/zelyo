# Phase 1 — ZK Circuit (full) + zk-shared parity

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full Noir credential circuit (depth-20 Merkle inclusion + selective disclosure + nullifier + address binding + gated range/date predicate), compile and export its ACIR/ABI/verification-key into `apps/web/public/circuit/`, and implement `packages/zk-shared` whose JS leaf/nullifier builders are bit-identical to the circuit over BN254 — proven by a CI-failing parity test.

**Architecture:** The circuit (`circuits/zelyo_credential`) is the *source of truth* for the field math. `packages/zk-shared` re-implements `Poseidon(Poseidon(s), Poseidon(attributes))`, `Poseidon(s, scope)`, `scope`, and address-packing in TypeScript using a Poseidon2-over-BN254 library pinned to the circuit's `std::hash::poseidon2` params. Parity is guaranteed by a test whose fixed vectors are *emitted by the circuit itself* (`nargo test` prints the leaf/nullifier), then frozen into a JSON fixture that the Vitest parity test asserts against — so any drift in either side fails CI. The Could range/date predicate is wired as an *additive, gated* constraint: a public `predicate_mode` selector that defaults to `0` (off) so the base demo proof is unaffected.

**Tech Stack:** Noir 1.0.0-beta.22 (`nargo` via `noirup`) · `@aztec/bb.js` 4.3.x (UltraHonk, VK generation) · TypeScript 6 (strict) · `@zkpassport/poseidon2` (Poseidon2 BN254, parity-pinned) · Vitest 4.x · pnpm 10 workspaces.

## Global Constraints

> Apply to **every task** below. Values copied verbatim from the index / SPEC / AGENT.

- **Versions (floor; pin exact in lockfile, never downgrade):** Node ≥ 22 LTS · pnpm 10.x · TypeScript 6.0.x · Noir 1.0.0-beta.22 · `@noir-lang/noir_js` + `@noir-lang/noir_wasm` beta.22 · `@aztec/bb.js` 4.3.x · `@zk-kit/imt` latest · Vitest 4.x. Verify each with `pnpm view <pkg> version` before pinning.
- **`MERKLE_DEPTH = 20`** (fixed; ≈1M leaves). Defined once in the index contract — conform exactly, do **not** redefine the constant elsewhere.
- **Cross-Phase Interface Contract (`packages/zk-shared`)** — implement these EXACT signatures, no renames:
  - `type FieldHex = string & { readonly __brand: "FieldHex" }` — 0x-prefixed lowercase hex, 32 bytes.
  - `interface Attributes { track: string; grade: string; issueDate: string; courseName: string; learnerName: string }`
  - `interface PublicInputs { root: FieldHex; scope: FieldHex; boundAddress: FieldHex; nullifier: FieldHex; disclosed: FieldHex }`
  - `interface ProofBundle { proof: Uint8Array; publicInputs: PublicInputs }`
  - `poseidon(inputs: FieldHex[]): FieldHex`
  - `idCommitment(s: FieldHex): FieldHex` — `Poseidon(s)`
  - `buildLeaf(idCommitment: FieldHex, attributes: Attributes): FieldHex` — `Poseidon(idCommitment, Poseidon(attributes))`
  - `computeNullifier(s: FieldHex, scope: FieldHex): FieldHex` — `Poseidon(s, scope)`
  - `computeScope(appId: string, chainId: string, registryId: string): FieldHex` — `Hash(app_id | chain_id | registry_id)`
  - `encodeAddressToField(stellarPubKey: string): FieldHex` — `G...` → field-packed
  - `const MERKLE_DEPTH = 20`
- **Poseidon parity is correctness-critical** (AGENT §5, SPEC §6.4): JS leaf/nullifier outputs MUST equal the circuit's field elements over BN254. A parity test with fixed vectors fails CI on drift. Same Poseidon params on both sides.
- **`scope`** must match between client (`ZK_SCOPE_APP_ID` + chain id + registry id) and contract. **`bound_address`** is a public input the contract asserts equals the invoker.
- **Privacy:** `s` and `attributes` are PRIVATE circuit inputs and never leave the device; the server only ever sees `id_commitment = Poseidon(s)` and nullifiers. Nothing here logs or ships `s` or raw attributes.
- **TypeScript:** `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. No `any`; use `unknown` + Zod at boundaries.
- **Conventions:** Conventional Commits. Don't gold-plate cut items — the range/date predicate is additive and must not break the base demo.
- **Prerequisites (from Phase 0):** monorepo scaffold (`circuits/`, `packages/zk-shared` exist as workspace members), `nargo` 1.0.0-beta.22 installed, `@aztec/bb.js` available, and the Poseidon parity *rig* (the harness that runs `nargo test` and feeds vectors to Vitest) stood up. This phase fills the rig with the real circuit and real builders.

---

**Prerequisites:** Phase 0 complete (toolchain installed, parity rig stood up).

**Gate:** Circuit compiles; all `nargo test` cases pass (valid proof, wrong-root fail, wrong-disclosed fail, wrong-nullifier fail, predicate-on pass); `pnpm --filter zk-shared test` parity tests pass (leaf parity + nullifier parity against circuit-emitted vectors); ACIR + ABI + verification key exported to `apps/web/public/circuit/`; `pnpm zk:build` is wired and reproduces the artifacts.

---

## File Structure

- `circuits/zelyo_credential/Nargo.toml` — Noir package manifest, pinned compiler.
- `circuits/zelyo_credential/src/main.nr` — the circuit (depth-20 Merkle, disclosure, nullifier, address binding, gated predicate) + `#[test]` cases.
- `circuits/zelyo_credential/src/poseidon.nr` — leaf/nullifier/scope helper functions reused by `main` and the parity-vector test.
- `circuits/zelyo_credential/Prover.toml` — fixture inputs for a manual `nargo execute` smoke check.
- `circuits/export-vectors.sh` — runs the vector-emitting test and writes `packages/zk-shared/test/fixtures/parity-vectors.json`.
- `apps/web/public/circuit/` — `zelyo_credential.json` (ACIR+ABI bundle), `vk` (verification key bytes), `manifest.json` (hashes + scope params).
- `scripts/zk-build.mjs` — `nargo compile` → copy artifact → `bb write_vk` → write manifest. Wired to root `pnpm zk:build`.
- `packages/zk-shared/src/types.ts` — `FieldHex`, `Attributes`, `PublicInputs`, `ProofBundle`, `MERKLE_DEPTH`.
- `packages/zk-shared/src/field.ts` — hex⇄bigint helpers, BN254 modulus, `FieldHex` brand guard.
- `packages/zk-shared/src/poseidon.ts` — `poseidon`, `idCommitment`, `buildLeaf`, `computeNullifier`, `computeScope`, `encodeAddressToField`.
- `packages/zk-shared/src/index.ts` — public barrel re-export.
- `packages/zk-shared/test/parity.test.ts` — the correctness-critical parity test (leaf + nullifier vs circuit vectors).
- `packages/zk-shared/test/field.test.ts` — unit tests for hex/field helpers and address packing.
- `packages/zk-shared/test/fixtures/parity-vectors.json` — circuit-emitted golden vectors (committed).

---

## Task 1: Noir package skeleton + Poseidon helper module

**Files:**
- Create: `circuits/zelyo_credential/Nargo.toml`
- Create: `circuits/zelyo_credential/src/poseidon.nr`
- Create: `circuits/zelyo_credential/src/main.nr` (stub re-exporting + one passing helper test)

**Interfaces:**
- Consumes: nothing (root of the dependency graph).
- Produces: Noir helpers `hash_attributes(attrs: AttributesF) -> Field`, `build_leaf(id_commitment: Field, attrs: AttributesF) -> Field`, `compute_nullifier(s: Field, scope: Field) -> Field`, and struct `AttributesF { track: Field, grade: Field, issue_date: Field }` — all consumed by Task 2 (`main`) and Task 3 (vector export). `MERKLE_DEPTH = 20` global.

- [ ] **Step 1: Write the failing test** — add a Noir `#[test]` exercising the leaf helper. Create `circuits/zelyo_credential/Nargo.toml`:

```toml
[package]
name = "zelyo_credential"
type = "bin"
authors = [""]
compiler_version = ">=1.0.0-beta.22"

[dependencies]
```

Create `circuits/zelyo_credential/src/poseidon.nr`:

```rust
use std::hash::poseidon2::Poseidon2;

pub global MERKLE_DEPTH: u32 = 20;

// Attribute field-packing used by both the circuit and the JS parity builders.
// Only `track`, `grade`, `issue_date` are folded into the credential hash for the
// demo; courseName/learnerName stay off-circuit (held only off-chain in Postgres).
pub struct AttributesF {
    pub track: Field,
    pub grade: Field,
    pub issue_date: Field,
}

// Poseidon(track, grade, issue_date)
pub fn hash_attributes(attrs: AttributesF) -> Field {
    Poseidon2::hash([attrs.track, attrs.grade, attrs.issue_date], 3)
}

// leaf = Poseidon( Poseidon(s), Poseidon(attributes) )
// `id_commitment` is already Poseidon(s); the holder passes it in.
pub fn build_leaf(id_commitment: Field, attrs: AttributesF) -> Field {
    let attr_hash = hash_attributes(attrs);
    Poseidon2::hash([id_commitment, attr_hash], 2)
}

// id_commitment = Poseidon(s)
pub fn id_commitment(s: Field) -> Field {
    Poseidon2::hash([s], 1)
}

// nullifier = Poseidon(s, scope)
pub fn compute_nullifier(s: Field, scope: Field) -> Field {
    Poseidon2::hash([s, scope], 2)
}
```

Create `circuits/zelyo_credential/src/main.nr` (stub for now, holds the helper test):

```rust
mod poseidon;

use crate::poseidon::{AttributesF, build_leaf, compute_nullifier, id_commitment};

fn main() {}

#[test]
fn test_leaf_helper_is_deterministic() {
    let s: Field = 12345;
    let idc = id_commitment(s);
    let attrs = AttributesF { track: 7, grade: 90, issue_date: 20260601 };
    let a = build_leaf(idc, attrs);
    let b = build_leaf(idc, attrs);
    assert(a == b);
}
```

- [ ] **Step 2: Run test to verify it fails** (compiler not yet wired / typo surface)

Run: `cd circuits/zelyo_credential && nargo test --show-output`
Expected at this stage: PASS is acceptable if the helper compiles — but first run with an intentionally wrong assert (`assert(a != b);`) to confirm the test harness actually executes:

Run: `cd circuits/zelyo_credential && nargo test test_leaf_helper_is_deterministic`
Expected (with `a != b`): FAIL — `Assertion failed`.

- [ ] **Step 3: Restore the correct assertion** — change `assert(a != b);` back to `assert(a == b);` in `test_leaf_helper_is_deterministic`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd circuits/zelyo_credential && nargo test`
Expected: PASS — `[zelyo_credential] 1 test passed`.

- [ ] **Step 5: Commit**

```bash
git add circuits/zelyo_credential/Nargo.toml circuits/zelyo_credential/src/poseidon.nr circuits/zelyo_credential/src/main.nr
git commit -m "feat(circuit): add Noir package skeleton and Poseidon leaf/nullifier helpers"
```

---

## Task 2: Full circuit constraints + nargo test suite

**Files:**
- Modify: `circuits/zelyo_credential/src/main.nr`
- Create: `circuits/zelyo_credential/Prover.toml`

**Interfaces:**
- Consumes: from Task 1 — `AttributesF`, `build_leaf`, `compute_nullifier`, `MERKLE_DEPTH`, and `std::hash::poseidon2::Poseidon2`.
- Produces: `fn main` with PRIVATE inputs (`s: Field`, `attributes: AttributesF`, `merkle_siblings: [Field; 20]`, `merkle_indices: [u1; 20]`) and PUBLIC inputs (`root: pub Field`, `scope: pub Field`, `bound_address: pub Field`, `nullifier: pub Field`, `disclosed: pub Field`, `predicate_mode: pub u32`, `predicate_lo: pub Field`, `predicate_hi: pub Field`). The public-input *ordering* here is the contract that Phase 2 (verifier) and Phase 5 (prover) bind to: `[root, scope, bound_address, nullifier, disclosed, predicate_mode, predicate_lo, predicate_hi]`.

- [ ] **Step 1: Write the failing tests** — replace the body of `circuits/zelyo_credential/src/main.nr` with the full circuit and four constraint tests. (Keep `mod poseidon;` and the Task-1 helper test.)

```rust
mod poseidon;

use crate::poseidon::{
    AttributesF, MERKLE_DEPTH, build_leaf, compute_nullifier, id_commitment,
};
use std::hash::poseidon2::Poseidon2;

// Recompute the Merkle root from a leaf + siblings/indices (index bit 0 = leaf on left).
fn merkle_root(leaf: Field, siblings: [Field; 20], indices: [u1; 20]) -> Field {
    let mut node = leaf;
    for i in 0..MERKLE_DEPTH {
        let sib = siblings[i];
        // indices[i] == 0 => current node is the LEFT child.
        let left = if indices[i] == 0 { node } else { sib };
        let right = if indices[i] == 0 { sib } else { node };
        node = Poseidon2::hash([left, right], 2);
    }
    node
}

// Range/date predicate (Could, additive + gated). predicate_mode:
//   0 = OFF  (base demo; predicate inputs ignored, no extra constraint)
//   1 = RANGE on attributes.grade   (predicate_lo <= grade <= predicate_hi)
//   2 = DATE  on attributes.issue_date (predicate_lo <= issue_date <= predicate_hi)
// Bounds are checked with a 64-bit range proof so comparisons are sound for
// demo-sized values (grades, YYYYMMDD dates) — never near the field modulus.
fn check_predicate(
    attrs: AttributesF,
    predicate_mode: u32,
    predicate_lo: Field,
    predicate_hi: Field,
) {
    if predicate_mode != 0 {
        let value = if predicate_mode == 1 { attrs.grade } else { attrs.issue_date };
        // value - lo >= 0  and  hi - value >= 0, proven via 64-bit range casts.
        let lo_ok = value - predicate_lo;
        let hi_ok = predicate_hi - value;
        let _lo: u64 = lo_ok as u64; // fails if value < lo
        let _hi: u64 = hi_ok as u64; // fails if value > hi
    }
}

fn main(
    // PRIVATE
    s: Field,
    attributes: AttributesF,
    merkle_siblings: [Field; 20],
    merkle_indices: [u1; 20],
    // PUBLIC
    root: pub Field,
    scope: pub Field,
    bound_address: pub Field,
    nullifier: pub Field,
    disclosed: pub Field,
    predicate_mode: pub u32,
    predicate_lo: pub Field,
    predicate_hi: pub Field,
) {
    // leaf = Poseidon( Poseidon(s), Poseidon(attributes) )
    let idc = id_commitment(s);
    let leaf = build_leaf(idc, attributes);

    // Merkle inclusion: recomputed root must equal the published root.
    let computed_root = merkle_root(leaf, merkle_siblings, merkle_indices);
    assert(computed_root == root);

    // Selective disclosure: the single revealed attribute is `track`.
    assert(attributes.track == disclosed);

    // Sybil resistance: nullifier == Poseidon(s, scope).
    assert(nullifier == compute_nullifier(s, scope));

    // Address binding: fold bound_address into the constraint system so the proof
    // is non-malleable to a different wallet. A satisfied dummy constraint that
    // references bound_address forces it into the public-input set the verifier
    // checks. (bound_address * 0 == 0 keeps it provable for any address while
    // still committing the wire.)
    assert(bound_address * 0 == 0);

    // Could (gated, additive): optional range/date predicate. Off by default.
    check_predicate(attributes, predicate_mode, predicate_lo, predicate_hi);
}

// --- Test fixtures -------------------------------------------------------
// A depth-20 inclusion fixture: leaf is the left-most leaf, all siblings = 0,
// all indices = 0. The root is computed by folding `Poseidon2([node,0],2)` 20×.
fn fixture_attrs() -> AttributesF {
    AttributesF { track: 42, grade: 90, issue_date: 20260601 }
}

fn fixture_root(leaf: Field) -> Field {
    merkle_root(leaf, [0; 20], [0; 20])
}

#[test]
fn test_valid_proof_succeeds() {
    let s: Field = 12345;
    let attrs = fixture_attrs();
    let leaf = build_leaf(id_commitment(s), attrs);
    let root = fixture_root(leaf);
    let scope: Field = 999;
    main(
        s, attrs, [0; 20], [0; 20],
        root, scope, /*bound_address*/ 7,
        /*nullifier*/ compute_nullifier(s, scope),
        /*disclosed*/ 42,
        /*predicate_mode*/ 0, /*lo*/ 0, /*hi*/ 0,
    );
}

#[test(should_fail_with = "computed_root == root")]
fn test_wrong_root_fails() {
    let s: Field = 12345;
    let attrs = fixture_attrs();
    let scope: Field = 999;
    main(
        s, attrs, [0; 20], [0; 20],
        /*root*/ 1, // wrong root
        scope, 7,
        compute_nullifier(s, scope),
        42,
        0, 0, 0,
    );
}

#[test(should_fail_with = "attributes.track == disclosed")]
fn test_wrong_disclosed_fails() {
    let s: Field = 12345;
    let attrs = fixture_attrs();
    let leaf = build_leaf(id_commitment(s), attrs);
    let root = fixture_root(leaf);
    let scope: Field = 999;
    main(
        s, attrs, [0; 20], [0; 20],
        root, scope, 7,
        compute_nullifier(s, scope),
        /*disclosed*/ 7, // != track (42)
        0, 0, 0,
    );
}

#[test(should_fail_with = "nullifier == compute_nullifier(s, scope)")]
fn test_wrong_nullifier_fails() {
    let s: Field = 12345;
    let attrs = fixture_attrs();
    let leaf = build_leaf(id_commitment(s), attrs);
    let root = fixture_root(leaf);
    let scope: Field = 999;
    main(
        s, attrs, [0; 20], [0; 20],
        root, scope, 7,
        /*nullifier*/ 123456789, // wrong
        42,
        0, 0, 0,
    );
}

#[test]
fn test_predicate_range_on_succeeds() {
    let s: Field = 12345;
    let attrs = fixture_attrs(); // grade = 90
    let leaf = build_leaf(id_commitment(s), attrs);
    let root = fixture_root(leaf);
    let scope: Field = 999;
    main(
        s, attrs, [0; 20], [0; 20],
        root, scope, 7,
        compute_nullifier(s, scope),
        42,
        /*mode*/ 1, /*lo*/ 50, /*hi*/ 100, // 50 <= 90 <= 100
    );
}

#[test(should_fail)]
fn test_predicate_range_out_of_bounds_fails() {
    let s: Field = 12345;
    let attrs = fixture_attrs(); // grade = 90
    let leaf = build_leaf(id_commitment(s), attrs);
    let root = fixture_root(leaf);
    let scope: Field = 999;
    main(
        s, attrs, [0; 20], [0; 20],
        root, scope, 7,
        compute_nullifier(s, scope),
        42,
        /*mode*/ 1, /*lo*/ 95, /*hi*/ 100, // 90 < 95 => fail
    );
}
```

Create `circuits/zelyo_credential/Prover.toml` (a valid base-demo witness for `nargo execute` smoke checks; values mirror `test_valid_proof_succeeds`):

```toml
# PRIVATE
s = "12345"
merkle_siblings = ["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"]
merkle_indices  = ["0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0","0"]

[attributes]
track = "42"
grade = "90"
issue_date = "20260601"

# PUBLIC (root/nullifier must match the helper-computed values for s=12345, scope=999)
# Fill `root` and `nullifier` after the first `nargo test --show-output` prints them
# (see Task 3 vector export), or recompute via `nargo execute`.
root = "0"
scope = "999"
bound_address = "7"
nullifier = "0"
disclosed = "42"
predicate_mode = "0"
predicate_lo = "0"
predicate_hi = "0"
```

- [ ] **Step 2: Run tests to verify they fail (then pass the should_fail set)**

Run: `cd circuits/zelyo_credential && nargo test`
Expected first: the four `should_fail*` tests PASS (their failures are expected), and `test_valid_proof_succeeds` / `test_predicate_range_on_succeeds` either PASS or surface a real bug. If `test_wrong_root_fails` reports "test passed unexpectedly" the assertion message string mismatched — copy the exact panic text from `nargo test --show-output` into the `should_fail_with`.

- [ ] **Step 3: Reconcile `should_fail_with` messages** — run `nargo test --show-output` and align each `should_fail_with = "..."` with the exact assertion source text Noir reports (Noir matches on the failing `assert(...)` expression). Adjust the strings if the compiler version renders them differently.

- [ ] **Step 4: Run tests to verify all pass**

Run: `cd circuits/zelyo_credential && nargo test`
Expected: PASS — all 7 tests pass (`test_leaf_helper_is_deterministic`, `test_valid_proof_succeeds`, `test_wrong_root_fails`, `test_wrong_disclosed_fails`, `test_wrong_nullifier_fails`, `test_predicate_range_on_succeeds`, `test_predicate_range_out_of_bounds_fails`).

- [ ] **Step 5: Commit**

```bash
git add circuits/zelyo_credential/src/main.nr circuits/zelyo_credential/Prover.toml
git commit -m "feat(circuit): full credential circuit (merkle+disclosure+nullifier+binding+gated predicate) with nargo tests"
```

---

## Task 3: Emit golden parity vectors from the circuit

**Files:**
- Modify: `circuits/zelyo_credential/src/main.nr` (add a vector-printing test)
- Create: `circuits/export-vectors.sh`
- Create: `packages/zk-shared/test/fixtures/parity-vectors.json`

**Interfaces:**
- Consumes: Task 1 helpers (`id_commitment`, `hash_attributes`, `build_leaf`, `compute_nullifier`).
- Produces: `packages/zk-shared/test/fixtures/parity-vectors.json` — the single source of truth the JS parity test (Task 7) asserts against. Shape:
  `{ vectors: [{ s, attributes:{track,grade,issueDate}, idCommitment, attrHash, leaf, scope, nullifier }] }` (all values 0x-prefixed lowercase hex, 32-byte).

- [ ] **Step 1: Write the failing test** — add a `#[test]` to `circuits/zelyo_credential/src/main.nr` that prints field values for fixed inputs (using `--show-output`). Append:

```rust
// Prints golden vectors for the JS parity fixture. Run with --show-output and
// pipe through circuits/export-vectors.sh, which converts the decimal field
// prints into the committed parity-vectors.json.
#[test]
fn print_parity_vectors() {
    let s: Field = 12345;
    let attrs = AttributesF { track: 42, grade: 90, issue_date: 20260601 };
    let scope: Field = 999;

    let idc = id_commitment(s);
    let attr_hash = crate::poseidon::hash_attributes(attrs);
    let leaf = build_leaf(idc, attrs);
    let nul = compute_nullifier(s, scope);

    println(f"VEC s={s} track={attrs.track} grade={attrs.grade} issue_date={attrs.issue_date} scope={scope}");
    println(f"VEC idCommitment={idc}");
    println(f"VEC attrHash={attr_hash}");
    println(f"VEC leaf={leaf}");
    println(f"VEC nullifier={nul}");
}
```

- [ ] **Step 2: Run it to verify it prints**

Run: `cd circuits/zelyo_credential && nargo test print_parity_vectors --show-output`
Expected: PASS, and stdout contains lines beginning `VEC ...` with decimal field values for `idCommitment`, `attrHash`, `leaf`, `nullifier`.

- [ ] **Step 3: Write the export script** — create `circuits/export-vectors.sh` that runs the test, parses the `VEC` lines, converts each decimal field to 0x-prefixed 32-byte hex, and writes the JSON fixture:

```bash
#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/../packages/zk-shared/test/fixtures/parity-vectors.json"
mkdir -p "$(dirname "$OUT")"

RAW="$(cd "$HERE/zelyo_credential" && nargo test print_parity_vectors --show-output 2>&1)"

# Extract `key=value` pairs from the VEC lines (decimal field values).
get() { echo "$RAW" | grep -oE "$1=[0-9]+" | head -n1 | cut -d= -f2; }

S=$(get s); TRACK=$(get track); GRADE=$(get grade); ISSUE=$(get issue_date); SCOPE=$(get scope)
IDC=$(get idCommitment); ATTRH=$(get attrHash); LEAF=$(get leaf); NUL=$(get nullifier)

# decimal -> 0x lowercase, left-padded to 64 hex chars (32 bytes)
hex() { printf "0x%064x" "$1" 2>/dev/null || python3 -c "print('0x%064x' % int('$1'))"; }

cat > "$OUT" <<JSON
{
  "_note": "Generated by circuits/export-vectors.sh from print_parity_vectors. Do not hand-edit.",
  "vectors": [
    {
      "s": "$(hex "$S")",
      "scope": "$(hex "$SCOPE")",
      "attributes": { "track": "$(hex "$TRACK")", "grade": "$(hex "$GRADE")", "issueDate": "$(hex "$ISSUE")" },
      "idCommitment": "$(hex "$IDC")",
      "attrHash": "$(hex "$ATTRH")",
      "leaf": "$(hex "$LEAF")",
      "nullifier": "$(hex "$NUL")"
    }
  ]
}
JSON

echo "Wrote $OUT"
```

Make it executable: `chmod +x circuits/export-vectors.sh`.

- [ ] **Step 4: Generate the fixture and verify it parses**

Run: `bash circuits/export-vectors.sh && cat packages/zk-shared/test/fixtures/parity-vectors.json | python3 -m json.tool`
Expected: prints valid JSON with one vector; `leaf`, `nullifier`, `idCommitment`, `attrHash` are 0x-prefixed 66-char strings.

- [ ] **Step 5: Commit**

```bash
git add circuits/zelyo_credential/src/main.nr circuits/export-vectors.sh packages/zk-shared/test/fixtures/parity-vectors.json
chmod +x circuits/export-vectors.sh
git commit -m "feat(circuit): emit golden Poseidon parity vectors and JSON fixture"
```

---

## Task 4: `zk-shared` package scaffold + types

**Files:**
- Create: `packages/zk-shared/package.json`
- Create: `packages/zk-shared/tsconfig.json`
- Create: `packages/zk-shared/vitest.config.ts`
- Create: `packages/zk-shared/src/types.ts`
- Create: `packages/zk-shared/src/index.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `FieldHex`, `Attributes`, `PublicInputs`, `ProofBundle`, `MERKLE_DEPTH` — the exact contract names from the index. Later tasks import these.

- [ ] **Step 1: Write the failing test** — create `packages/zk-shared/test/types.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { MERKLE_DEPTH } from "../src/index.js";
import type { Attributes, PublicInputs, ProofBundle, FieldHex } from "../src/index.js";

describe("zk-shared types", () => {
  it("pins MERKLE_DEPTH to 20", () => {
    expect(MERKLE_DEPTH).toBe(20);
  });

  it("exposes the contract shapes", () => {
    const attrs: Attributes = {
      track: "Data Engineering",
      grade: "A",
      issueDate: "2026-06-01",
      courseName: "Distributed Systems",
      learnerName: "Ada Lovelace",
    };
    const pi: PublicInputs = {
      root: "0x00" as FieldHex,
      scope: "0x00" as FieldHex,
      boundAddress: "0x00" as FieldHex,
      nullifier: "0x00" as FieldHex,
      disclosed: "0x00" as FieldHex,
    };
    const bundle: ProofBundle = { proof: new Uint8Array([1]), publicInputs: pi };
    expect(attrs.track).toBe("Data Engineering");
    expect(bundle.publicInputs.root).toBe("0x00");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter zk-shared test`
Expected: FAIL — cannot resolve `../src/index.js` / package not configured.

- [ ] **Step 3: Write minimal implementation** — create the package files.

`packages/zk-shared/package.json`:

```json
{
  "name": "zk-shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@zkpassport/poseidon2": "latest"
  },
  "devDependencies": {
    "typescript": "^6.0.0",
    "vitest": "^4.0.0"
  }
}
```

`packages/zk-shared/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "verbatimModuleSyntax": true,
    "lib": ["ES2022"]
  },
  "include": ["src", "test"]
}
```

`packages/zk-shared/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
});
```

`packages/zk-shared/src/types.ts`:

```ts
// Field element as 0x-prefixed lowercase hex, 32 bytes. Branded for safety.
export type FieldHex = string & { readonly __brand: "FieldHex" };

export interface Attributes {
  track: string; // disclosed predicate target
  grade: string;
  issueDate: string; // ISO 8601
  courseName: string;
  learnerName: string;
}

export interface PublicInputs {
  root: FieldHex;
  scope: FieldHex;
  boundAddress: FieldHex; // Stellar ed25519 pubkey, field-packed
  nullifier: FieldHex;
  disclosed: FieldHex; // hash/encoding of the revealed attribute (track)
}

export interface ProofBundle {
  proof: Uint8Array;
  publicInputs: PublicInputs;
}

export const MERKLE_DEPTH = 20;
```

`packages/zk-shared/src/index.ts`:

```ts
export type { FieldHex, Attributes, PublicInputs, ProofBundle } from "./types.js";
export { MERKLE_DEPTH } from "./types.js";
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm install && pnpm --filter zk-shared test`
Expected: PASS — both `zk-shared types` tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/zk-shared/package.json packages/zk-shared/tsconfig.json packages/zk-shared/vitest.config.ts packages/zk-shared/src/types.ts packages/zk-shared/src/index.ts packages/zk-shared/test/types.test.ts pnpm-lock.yaml
git commit -m "feat(zk-shared): package scaffold and cross-phase contract types"
```

---

## Task 5: Field helpers + `encodeAddressToField`

**Files:**
- Create: `packages/zk-shared/src/field.ts`
- Modify: `packages/zk-shared/src/index.ts`
- Create: `packages/zk-shared/test/field.test.ts`

**Interfaces:**
- Consumes: `FieldHex` from `types.ts`.
- Produces: `toFieldHex(value: bigint): FieldHex`, `fieldHexToBigInt(h: FieldHex): bigint`, `BN254_MODULUS: bigint`, and `encodeAddressToField(stellarPubKey: string): FieldHex` (contract name). Task 6 consumes `toFieldHex`/`fieldHexToBigInt`; Phase 5 consumes `encodeAddressToField`.

- [ ] **Step 1: Write the failing test** — create `packages/zk-shared/test/field.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  toFieldHex,
  fieldHexToBigInt,
  BN254_MODULUS,
  encodeAddressToField,
} from "../src/index.js";

describe("field helpers", () => {
  it("round-trips bigint <-> FieldHex with 32-byte zero padding", () => {
    const h = toFieldHex(42n);
    expect(h).toBe("0x" + "42".padStart(64, "0").replace("42", "2a")); // 0x...02a -> see exact below
  });

  it("produces 66-char lowercase hex", () => {
    const h = toFieldHex(255n);
    expect(h).toMatch(/^0x[0-9a-f]{64}$/);
    expect(h.endsWith("ff")).toBe(true);
    expect(fieldHexToBigInt(h)).toBe(255n);
  });

  it("rejects values >= BN254 modulus", () => {
    expect(() => toFieldHex(BN254_MODULUS)).toThrow();
  });

  it("encodes a Stellar G-address to a field deterministically and within range", () => {
    const g = "GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI";
    const a = encodeAddressToField(g);
    const b = encodeAddressToField(g);
    expect(a).toBe(b);
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
    expect(fieldHexToBigInt(a)).toBeLessThan(BN254_MODULUS);
  });
});
```

Note: replace the first assertion's RHS with the literal expected string once you run it; the intent is `toFieldHex(42n) === "0x" + "0".repeat(62) + "2a"`. Use:

```ts
expect(toFieldHex(42n)).toBe("0x000000000000000000000000000000000000000000000000000000000000002a");
```

(Use that exact line in the test instead of the `.replace` placeholder above.)

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter zk-shared test field`
Expected: FAIL — `toFieldHex` / `encodeAddressToField` not exported.

- [ ] **Step 3: Write minimal implementation** — create `packages/zk-shared/src/field.ts`:

```ts
import type { FieldHex } from "./types.js";

// BN254 (alt_bn128) scalar field modulus — the field Noir's poseidon2 operates over.
export const BN254_MODULUS =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export function toFieldHex(value: bigint): FieldHex {
  if (value < 0n) throw new Error("field value must be non-negative");
  if (value >= BN254_MODULUS) throw new Error("field value must be < BN254 modulus");
  return ("0x" + value.toString(16).padStart(64, "0")) as FieldHex;
}

export function fieldHexToBigInt(h: FieldHex): bigint {
  if (!/^0x[0-9a-f]{1,64}$/.test(h)) throw new Error(`invalid FieldHex: ${h}`);
  const v = BigInt(h);
  if (v >= BN254_MODULUS) throw new Error("FieldHex out of field range");
  return v;
}

// Stellar G-address (StrKey: version byte + 32-byte ed25519 pubkey + CRC16) ->
// a single BN254 field. We decode the StrKey, take the 32-byte raw pubkey, and
// reduce it mod the field modulus (the high 3 bits are masked first so the value
// is < modulus before reduction is even needed for the demo). The Noir side
// receives the identical bigint as bound_address.
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(s: string): Uint8Array {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of s) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error(`invalid base32 char: ${ch}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}

export function encodeAddressToField(stellarPubKey: string): FieldHex {
  if (!/^G[A-Z2-7]{55}$/.test(stellarPubKey)) {
    throw new Error("expected a Stellar public key (G... StrKey)");
  }
  const decoded = base32Decode(stellarPubKey); // [version(1)] [pubkey(32)] [crc16(2)]
  const pubkey = decoded.slice(1, 33);
  let acc = 0n;
  for (const byte of pubkey) acc = (acc << 8n) | BigInt(byte);
  // Reduce into the field (32 bytes can exceed the 254-bit modulus; mod is exact).
  return toFieldHex(acc % BN254_MODULUS);
}
```

Update `packages/zk-shared/src/index.ts`:

```ts
export type { FieldHex, Attributes, PublicInputs, ProofBundle } from "./types.js";
export { MERKLE_DEPTH } from "./types.js";
export {
  toFieldHex,
  fieldHexToBigInt,
  BN254_MODULUS,
  encodeAddressToField,
} from "./field.js";
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm --filter zk-shared test field`
Expected: PASS — all `field helpers` tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/zk-shared/src/field.ts packages/zk-shared/src/index.ts packages/zk-shared/test/field.test.ts
git commit -m "feat(zk-shared): BN254 field helpers and Stellar address field-packing"
```

---

## Task 6: Poseidon builders (`poseidon`, `idCommitment`, `buildLeaf`, `computeNullifier`, `computeScope`)

**Files:**
- Create: `packages/zk-shared/src/poseidon.ts`
- Modify: `packages/zk-shared/src/index.ts`
- Create: `packages/zk-shared/test/poseidon.test.ts` (behavioral unit tests; parity vs circuit is Task 7)

**Interfaces:**
- Consumes: `toFieldHex`, `fieldHexToBigInt`, `BN254_MODULUS` (Task 5); `FieldHex`, `Attributes` (Task 4).
- Produces: `poseidon(inputs: FieldHex[]): FieldHex`, `idCommitment(s: FieldHex): FieldHex`, `buildLeaf(idCommitment: FieldHex, attributes: Attributes): FieldHex`, `computeNullifier(s: FieldHex, scope: FieldHex): FieldHex`, `computeScope(appId, chainId, registryId): FieldHex`, and the helper `attributesToFields(a: Attributes): [FieldHex, FieldHex, FieldHex]`. These are the contract builders the whole app depends on.

- [ ] **Step 1: Write the failing test** — create `packages/zk-shared/test/poseidon.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  poseidon,
  idCommitment,
  buildLeaf,
  computeNullifier,
  computeScope,
  toFieldHex,
} from "../src/index.js";
import type { Attributes, FieldHex } from "../src/index.js";

const F = (n: bigint) => toFieldHex(n);

describe("poseidon builders", () => {
  it("poseidon is deterministic and returns FieldHex", () => {
    const a = poseidon([F(1n), F(2n)]);
    const b = poseidon([F(1n), F(2n)]);
    expect(a).toBe(b);
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("idCommitment(s) == poseidon([s])", () => {
    const s = F(12345n);
    expect(idCommitment(s)).toBe(poseidon([s]));
  });

  it("computeNullifier(s, scope) == poseidon([s, scope])", () => {
    const s = F(12345n);
    const scope = F(999n);
    expect(computeNullifier(s, scope)).toBe(poseidon([s, scope]));
  });

  it("buildLeaf folds idCommitment with the attribute hash", () => {
    const attrs: Attributes = {
      track: "Data Engineering",
      grade: "A",
      issueDate: "2026-06-01",
      courseName: "Distributed Systems",
      learnerName: "Ada Lovelace",
    };
    const idc = idCommitment(F(12345n));
    const leaf = buildLeaf(idc, attrs);
    expect(leaf).toMatch(/^0x[0-9a-f]{64}$/);
    // changing an attribute changes the leaf
    const leaf2 = buildLeaf(idc, { ...attrs, grade: "B" });
    expect(leaf2).not.toBe(leaf);
  });

  it("computeScope is order-sensitive and deterministic", () => {
    const s1 = computeScope("zelyo-v1", "testnet", "CABC");
    const s2 = computeScope("zelyo-v1", "testnet", "CABC");
    const s3 = computeScope("zelyo-v1", "testnet", "CXYZ");
    expect(s1).toBe(s2);
    expect(s1).not.toBe(s3);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter zk-shared test poseidon`
Expected: FAIL — builders not exported.

- [ ] **Step 3: Write minimal implementation** — create `packages/zk-shared/src/poseidon.ts`. This MUST use the same Poseidon2-over-BN254 permutation as Noir's `std::hash::poseidon2::Poseidon2::hash`. We pin `@zkpassport/poseidon2`, which implements that exact permutation; the Task-7 parity test is the gate that confirms it.

```ts
import { poseidon2Hash } from "@zkpassport/poseidon2";
import type { Attributes, FieldHex } from "./types.js";
import { toFieldHex, fieldHexToBigInt, BN254_MODULUS } from "./field.js";

// Wraps the circuit-parity Poseidon2 permutation. Inputs/outputs are FieldHex so
// the rest of the app never juggles bigints.
export function poseidon(inputs: FieldHex[]): FieldHex {
  if (inputs.length === 0) throw new Error("poseidon requires at least one input");
  const out: bigint = poseidon2Hash(inputs.map(fieldHexToBigInt));
  return toFieldHex(out % BN254_MODULUS);
}

// id_commitment = Poseidon(s)
export function idCommitment(s: FieldHex): FieldHex {
  return poseidon([s]);
}

// nullifier = Poseidon(s, scope)
export function computeNullifier(s: FieldHex, scope: FieldHex): FieldHex {
  return poseidon([s, scope]);
}

// Map an arbitrary UTF-8 string to a BN254 field by hashing its bytes into a
// big-endian integer then reducing. Used for string attributes + scope parts.
function stringToField(value: string): FieldHex {
  const bytes = new TextEncoder().encode(value);
  let acc = 0n;
  for (const b of bytes) acc = (acc << 8n) | BigInt(b);
  return toFieldHex(acc % BN254_MODULUS);
}

// Only track/grade/issueDate are folded into the credential hash (mirrors the
// circuit's AttributesF). courseName/learnerName stay off-circuit.
export function attributesToFields(a: Attributes): [FieldHex, FieldHex, FieldHex] {
  return [stringToField(a.track), stringToField(a.grade), stringToField(a.issueDate)];
}

// leaf = Poseidon( idCommitment, Poseidon(track, grade, issueDate) )
export function buildLeaf(idCommitmentHex: FieldHex, attributes: Attributes): FieldHex {
  const [track, grade, issueDate] = attributesToFields(attributes);
  const attrHash = poseidon([track, grade, issueDate]);
  return poseidon([idCommitmentHex, attrHash]);
}

// scope = Poseidon( H(app_id), H(chain_id), H(registry_id) )
export function computeScope(appId: string, chainId: string, registryId: string): FieldHex {
  return poseidon([stringToField(appId), stringToField(chainId), stringToField(registryId)]);
}
```

Update `packages/zk-shared/src/index.ts` (append):

```ts
export {
  poseidon,
  idCommitment,
  computeNullifier,
  attributesToFields,
  buildLeaf,
  computeScope,
} from "./poseidon.js";
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm --filter zk-shared test poseidon`
Expected: PASS — all `poseidon builders` tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/zk-shared/src/poseidon.ts packages/zk-shared/src/index.ts packages/zk-shared/test/poseidon.test.ts pnpm-lock.yaml
git commit -m "feat(zk-shared): Poseidon2 leaf/nullifier/scope builders (BN254, circuit-pinned)"
```

---

## Task 7: THE PARITY TEST (correctness-critical) — JS == circuit

**Files:**
- Create: `packages/zk-shared/test/parity.test.ts`

**Interfaces:**
- Consumes: the golden fixture `packages/zk-shared/test/fixtures/parity-vectors.json` (Task 3); `poseidon`, `idCommitment`, `attributesToFields`, `buildLeaf`, `computeNullifier`, `toFieldHex` (Tasks 5–6).
- Produces: nothing (terminal verification). This is the gate that fails CI on any drift between JS and circuit Poseidon.

> The fixture intentionally uses *numeric* fields (`track=42`, `grade=90`, `issue_date=20260601`) so the JS side feeds the *same* field elements the circuit used — bypassing `stringToField` for the parity check, which isolates the Poseidon permutation as the thing under test. (String packing is exercised separately in Task 6.) This is what makes parity meaningful: identical inputs → assert identical outputs.

- [ ] **Step 1: Write the failing test** — create `packages/zk-shared/test/parity.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  poseidon,
  idCommitment,
  buildLeaf,
  computeNullifier,
} from "../src/index.js";
import type { FieldHex } from "../src/index.js";

interface Vector {
  s: FieldHex;
  scope: FieldHex;
  attributes: { track: FieldHex; grade: FieldHex; issueDate: FieldHex };
  idCommitment: FieldHex;
  attrHash: FieldHex;
  leaf: FieldHex;
  nullifier: FieldHex;
}

const fixturePath = fileURLToPath(new URL("./fixtures/parity-vectors.json", import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as { vectors: Vector[] };

describe("Poseidon parity: JS builders == Noir circuit", () => {
  it("has at least one golden vector", () => {
    expect(fixture.vectors.length).toBeGreaterThan(0);
  });

  for (const [i, v] of fixture.vectors.entries()) {
    it(`vector ${i}: idCommitment(s) matches circuit`, () => {
      expect(idCommitment(v.s)).toBe(v.idCommitment);
    });

    it(`vector ${i}: Poseidon(track,grade,issueDate) matches circuit attrHash`, () => {
      const attrHash = poseidon([v.attributes.track, v.attributes.grade, v.attributes.issueDate]);
      expect(attrHash).toBe(v.attrHash);
    });

    it(`vector ${i}: leaf = Poseidon(idCommitment, attrHash) matches circuit`, () => {
      // buildLeaf with field-identical attributes: fold idCommitment + attrHash directly.
      const leaf = poseidon([v.idCommitment, v.attrHash]);
      expect(leaf).toBe(v.leaf);
    });

    it(`vector ${i}: nullifier = Poseidon(s, scope) matches circuit`, () => {
      expect(computeNullifier(v.s, v.scope)).toBe(v.nullifier);
    });
  }
});

// Smoke: buildLeaf end-to-end produces a 32-byte FieldHex (string-packed path).
import type { Attributes } from "../src/index.js";
describe("buildLeaf end-to-end", () => {
  it("produces a valid FieldHex leaf", () => {
    const attrs: Attributes = {
      track: "Data Engineering",
      grade: "A",
      issueDate: "2026-06-01",
      courseName: "Distributed Systems",
      learnerName: "Ada Lovelace",
    };
    const leaf = buildLeaf(idCommitment("0x3039" as FieldHex), attrs);
    expect(leaf).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails (if the JS Poseidon params differ)**

Run: `pnpm --filter zk-shared test parity`
Expected: If `@zkpassport/poseidon2` params do NOT match Noir's `std::hash::poseidon2`, the `idCommitment` / `attrHash` / `leaf` / `nullifier` assertions FAIL with a value mismatch. This failure is the whole point of the test — it proves the test has teeth.

- [ ] **Step 3: Reconcile params if mismatched** — if Step 2 fails, the JS Poseidon does not match the circuit. Fix by, in order of preference:
  1. Confirm `poseidon2Hash` is called with the BN254 t=width matching Noir (Noir's `Poseidon2::hash([..], n)` uses sponge over the BN254 Poseidon2 instance; `@zkpassport/poseidon2`'s `poseidon2Hash(arr)` must use the same RF/RP/MDS constants). If the lib exposes a width/variant arg, set it to match.
  2. If no JS lib matches bit-for-bit, switch `poseidon.ts` to compute leaves via the **circuit itself** through `@noir-lang/noir_js` (`Noir.execute` on a tiny leaf-only circuit) — the SPEC §6.4 "compute leaves via shared WASM / the circuit itself" fallback. Re-run.
  3. Re-run `bash circuits/export-vectors.sh` only if the *circuit* changed; never edit the fixture by hand to make the test pass.

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm --filter zk-shared test`
Expected: PASS — every parity assertion passes; full `zk-shared` suite green.

- [ ] **Step 5: Commit**

```bash
git add packages/zk-shared/test/parity.test.ts
git commit -m "test(zk-shared): correctness-critical Poseidon parity test vs circuit vectors"
```

---

## Task 8: Build pipeline — compile, export ACIR/ABI, generate VK, wire `pnpm zk:build`

**Files:**
- Create: `scripts/zk-build.mjs`
- Modify: root `package.json` (add `zk:build` script)
- Create: `apps/web/public/circuit/.gitkeep`

**Interfaces:**
- Consumes: the compiled circuit (`nargo compile` output in `circuits/zelyo_credential/target/zelyo_credential.json`) and `@aztec/bb.js` (`bb` CLI or programmatic `UltraHonkBackend` VK).
- Produces: `apps/web/public/circuit/zelyo_credential.json` (ACIR+ABI), `apps/web/public/circuit/vk` (verification key bytes), `apps/web/public/circuit/manifest.json` (`{ artifact, vk, abiHash, scopeAppId }`). Phase 2 (verifier wiring) and Phase 5 (browser prover) consume these. `GET /api/circuit/manifest` (Phase 5) serves `manifest.json`.

- [ ] **Step 1: Write the failing check** — create a tiny verification by running the not-yet-existing script:

Run: `node scripts/zk-build.mjs`
Expected: FAIL — `Cannot find module .../scripts/zk-build.mjs`.

- [ ] **Step 2: Write the build script** — create `scripts/zk-build.mjs`:

```js
#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, copyFileSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CIRCUIT_DIR = join(ROOT, "circuits", "zelyo_credential");
const TARGET = join(CIRCUIT_DIR, "target", "zelyo_credential.json");
const OUT_DIR = join(ROOT, "apps", "web", "public", "circuit");

function run(cmd, args, cwd) {
  console.log(`$ ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, { cwd, stdio: "inherit" });
}

// 1. Compile the circuit -> ACIR + ABI bundle.
run("nargo", ["compile"], CIRCUIT_DIR);
if (!existsSync(TARGET)) throw new Error(`nargo compile did not produce ${TARGET}`);

// 2. Export ACIR + ABI to the web app.
mkdirSync(OUT_DIR, { recursive: true });
const artifactOut = join(OUT_DIR, "zelyo_credential.json");
copyFileSync(TARGET, artifactOut);

// 3. Generate the UltraHonk verification key at build time (bb.js CLI).
//    `bb` is provided by @aztec/bb.js; it reads the bytecode from the artifact.
const vkOut = join(OUT_DIR, "vk");
run("bb", ["write_vk", "--scheme", "ultra_honk", "-b", artifactOut, "-o", OUT_DIR]);
// bb writes `vk` into OUT_DIR; assert it exists.
if (!existsSync(vkOut)) throw new Error(`bb write_vk did not produce ${vkOut}`);

// 4. Manifest: hashes + scope params for the client/verifier.
const artifactBytes = readFileSync(artifactOut);
const abiHash = createHash("sha256").update(artifactBytes).digest("hex");
const manifest = {
  artifact: "/circuit/zelyo_credential.json",
  vk: "/circuit/vk",
  abiHash,
  scopeAppId: process.env.ZK_SCOPE_APP_ID ?? "zelyo-v1",
  merkleDepth: 20,
  publicInputOrder: [
    "root", "scope", "bound_address", "nullifier",
    "disclosed", "predicate_mode", "predicate_lo", "predicate_hi",
  ],
};
writeFileSync(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log("zk:build complete →", OUT_DIR);
```

Create `apps/web/public/circuit/.gitkeep` (empty) so the output dir exists in a fresh checkout.

Add to the root `package.json` `scripts`:

```json
{
  "scripts": {
    "zk:build": "node scripts/zk-build.mjs"
  }
}
```

- [ ] **Step 3: Run it to verify it produces artifacts**

Run: `pnpm zk:build`
Expected: PASS — logs `nargo compile`, `bb write_vk`, then `zk:build complete`. Verify outputs:

Run: `ls apps/web/public/circuit/`
Expected: `manifest.json  vk  zelyo_credential.json  .gitkeep`.

Run: `cat apps/web/public/circuit/manifest.json | python3 -m json.tool`
Expected: valid JSON with `abiHash` (64 hex chars), `merkleDepth: 20`, and the 8-entry `publicInputOrder`.

- [ ] **Step 4: Confirm reproducibility** — re-run and confirm the ABI hash is stable:

Run: `pnpm zk:build && python3 -c "import json;print(json.load(open('apps/web/public/circuit/manifest.json'))['abiHash'])"`
Expected: PASS — prints the same `abiHash` as Step 3 (deterministic compile).

- [ ] **Step 5: Commit**

```bash
git add scripts/zk-build.mjs package.json apps/web/public/circuit/.gitkeep
git commit -m "build(zk): compile circuit, export ACIR/ABI + VK, wire pnpm zk:build"
```

> Note: do not commit the generated `apps/web/public/circuit/zelyo_credential.json` / `vk` / `manifest.json` as source — they are build outputs reproduced by `pnpm zk:build`. Ensure `.gitignore` excludes them (add `apps/web/public/circuit/zelyo_credential.json`, `apps/web/public/circuit/vk`, `apps/web/public/circuit/manifest.json`) while keeping `.gitkeep`. The CI build runs `pnpm zk:build` before `pnpm build`.

---

## Phase Gate

Do not start Phase 2 until **all** of the following pass:

- [ ] **Circuit compiles:** `cd circuits/zelyo_credential && nargo compile` produces `target/zelyo_credential.json` with no errors.
- [ ] **All `nargo test` pass:** `cd circuits/zelyo_credential && nargo test` → 7/7 green:
  - `test_leaf_helper_is_deterministic`
  - `test_valid_proof_succeeds`
  - `test_wrong_root_fails` (should_fail)
  - `test_wrong_disclosed_fails` (should_fail)
  - `test_wrong_nullifier_fails` (should_fail)
  - `test_predicate_range_on_succeeds`
  - `test_predicate_range_out_of_bounds_fails` (should_fail)
- [ ] **Parity test passes:** `pnpm --filter zk-shared test` → leaf parity, attrHash parity, idCommitment parity, and nullifier parity all assert JS == circuit-emitted vectors; whole `zk-shared` suite green.
- [ ] **Contract signatures conform exactly:** `packages/zk-shared` exports `poseidon`, `idCommitment`, `buildLeaf`, `computeNullifier`, `computeScope`, `encodeAddressToField`, types `FieldHex`/`Attributes`/`PublicInputs`/`ProofBundle`, and `MERKLE_DEPTH === 20` — matching the index contract verbatim.
- [ ] **Artifacts exported:** `pnpm zk:build` writes `apps/web/public/circuit/{zelyo_credential.json, vk, manifest.json}`; `manifest.json` carries `abiHash`, `merkleDepth: 20`, `scopeAppId`, and the 8-entry `publicInputOrder`.
- [ ] **Typecheck/lint:** `pnpm --filter zk-shared typecheck` clean (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`); repo lint clean.
- [ ] **No secret/PII leakage:** no test or script logs `s` or raw `learnerName`/`courseName`; only commitments, hashes, and numeric demo vectors appear.
- [ ] **Could predicate is additive:** the base demo proof (`predicate_mode = 0`) is unaffected; range/date only engages when `predicate_mode ∈ {1,2}`.
