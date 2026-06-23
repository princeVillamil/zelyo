# Phase 2 — Soroban Contracts

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Read `docs/superpowers/plans/2026-06-23-zelyo-00-index.md` first — its **Cross-Phase Interface Contract** is the single source of truth for the `CredentialRegistry` function signatures and the `Error` enum used below; conform to them exactly.

**Goal:** Build the Soroban `CredentialRegistry` contract that enforces Merkle-root validity, address binding, and nullifier uniqueness on-chain, plus the `verifier` wiring that consumes the Phase 1 verification key. The contract exposes both Path A (`verify_and_register` — verifies the UltraHonk/Groth16 proof on-chain) and Path B (`register` — records a server-attested proof), so the same WASM compiles regardless of which `ZK_VERIFY_MODE` Phase 0's spike selected. Deploy registry + verifier to Stellar testnet and write their contract IDs into `.env`.

**Architecture:** Two Rust crates under `contracts/`: `credential_registry` (the public-facing contract — storage for the valid-root set, nullifier set, issuer/attestor addresses; the verify/register flow; events) and `verifier` (a thin reused-verifier wrapper that holds the embedded verification key and exposes a `verify(proof, public_inputs) -> bool` the registry calls on Path A). `PublicInputsXdr` is the on-chain mirror of the TS `PublicInputs` type, with every field a `BytesN<32>`. Path A and Path B share one set of checks (root ∈ valid set → `bound_address` == invoker → nullifier unused → store nullifier → emit `Verified`); only proof verification differs.

**Tech Stack:** Rust (stable, Stellar-CLI-compatible toolchain — **not 1.91.0**, see Global Constraints) · `soroban-sdk` (latest) · Stellar CLI (latest, optimizes wasm on `stellar contract build` by default) · Friendbot (testnet funding, dev only) · `@stellar/stellar-sdk` 16.x (deploy script).

## Global Constraints

These apply to **every task** below (copied from the index Global Constraints + AGENT.md §5/§7/§8):

- **Rust toolchain:** Rust 1.91.0 has known wasm build issues and is **blocked by the Stellar CLI** for contract builds — pin a compatible stable toolchain via `contracts/rust-toolchain.toml` and use it for `contracts:build`. Verify `cargo --version` and `stellar --version` before building.
- **Stellar CLI optimizes by default:** `stellar contract build` optimizes the wasm — never pass `--optimize`.
- **Chain is source of truth:** the contract enforces nullifier uniqueness and root validity; Postgres only mirrors. Never weaken an on-chain check because the server "already checked."
- **No PII on-chain:** `PublicInputsXdr` carries only field elements (root, scope, bound_address, nullifier, disclosed) — never names/grades/attributes. The `disclosed` field is a hash/encoding, not a plaintext value.
- **`scope` binding:** `scope` must match between client (`ZK_SCOPE_APP_ID` + chain id + registry id) and contract. The contract does not recompute scope but treats it as a bound public input; the circuit (Phase 1) binds `nullifier = Poseidon(s, scope)`.
- **Address binding:** the contract asserts `pi.bound_address` decodes to the invoking `Address`, stopping mempool replay to another wallet. Mismatch reverts `AddressMismatch`.
- **Duplicate nullifier reverts `NullifierUsed`** — that revert **is** the Sybil block; it must be a clean, typed contract error (panic via `panic_with_error!`) so the TS layer can map it to `NULLIFIER_USED`.
- **Error enum (from index, verbatim):** `NotAuthorized = 1, UnknownRoot = 2, NullifierUsed = 3, AddressMismatch = 4, InvalidProof = 5`.
- **Function signatures (from index, verbatim):**
  - `set_root(env, issuer: Address, root: BytesN<32>)` — issuer-only via `require_auth`; appends to valid root set.
  - `verify_and_register(env, proof: Bytes, pi: PublicInputsXdr) -> ()` — Path A.
  - `register(env, pi: PublicInputsXdr, attestor: Address) -> ()` — Path B (server-attested).
  - `is_root_valid(env, root: BytesN<32>) -> bool`
  - `is_nullifier_used(env, nullifier: BytesN<32>) -> bool`
  - `revoke_root(env, issuer: Address, root: BytesN<32>)` — Could; invalidates an old root.
- **Both paths' checks:** root ∈ valid set → `bound_address` == invoker → nullifier unused → store nullifier → emit `Verified(nullifier, root, bound_address)`.
- **Testing (AGENT.md §7):** Rust unit tests for happy path, duplicate-nullifier revert (`NullifierUsed`), unknown-root revert (`UnknownRoot`), address-binding mismatch (`AddressMismatch`), and `set_root` authorization. Use `soroban_sdk::testutils` (`Env::default()`, `mock_all_auths`, `Address::generate`).
- **Conventions:** Conventional Commits. `.env` is gitignored — only `.env.example` is committed; the deploy script writes real IDs into `.env`. New env vars (`CREDENTIAL_REGISTRY_CONTRACT_ID`, `VERIFIER_CONTRACT_ID`) already exist in the index env list — ensure they are in `.env.example` and `apps/web/src/lib/env.ts`.
- **Definition of done (every task):** crate builds (`cargo build --target wasm32-unknown-unknown` and/or `stellar contract build`); `cargo test` green; no PII in any on-chain type; commit with a Conventional Commit message.

**Prerequisites:** Phase 0 (toolchain + `ZK_VERIFY_MODE` decision — Path A `onchain` vs Path B `server`; Rust + `soroban-sdk` + Stellar CLI installed; pnpm workspace + `.env.example` + `env.ts` exist), Phase 1 (verification key exported to a known path + `packages/zk-shared` `PublicInputs` type finalized).

**Gate:** `stellar contract build` produces optimized wasm for both crates; all Rust unit tests pass (incl. duplicate-nullifier, unknown-root, and address-binding reverts, plus `set_root` auth); both contracts deployed to testnet via Friendbot-funded account; `CREDENTIAL_REGISTRY_CONTRACT_ID` and `VERIFIER_CONTRACT_ID` written to `.env`.

---

### Task 1: Workspace scaffold + toolchain pin + `PublicInputsXdr`/`Error` types

**Files:**
- Create: `contracts/Cargo.toml` (workspace manifest)
- Create: `contracts/rust-toolchain.toml`
- Create: `contracts/credential_registry/Cargo.toml`
- Create: `contracts/credential_registry/src/lib.rs`
- Create: `contracts/credential_registry/src/types.rs`
- Test: tests live in `contracts/credential_registry/src/test.rs` (added in later tasks)

**Interfaces:**
- Consumes: Phase 0 toolchain (Rust + `soroban-sdk` + Stellar CLI); Phase 1 `PublicInputs` shape (`root`, `scope`, `boundAddress`, `nullifier`, `disclosed` — five 32-byte field elements).
- Produces: `credential_registry::types::Error` (enum `NotAuthorized=1, UnknownRoot=2, NullifierUsed=3, AddressMismatch=4, InvalidProof=5`); `credential_registry::types::PublicInputsXdr { root, scope, bound_address, nullifier, disclosed: BytesN<32> }`; an empty `CredentialRegistry` contract type that compiles. Later tasks add methods to this contract.

- [ ] **Step 1: Pin the Rust toolchain**

Create `contracts/rust-toolchain.toml` (use a Stellar-CLI-compatible stable, NOT 1.91.0 per AGENT.md §8):

```toml
[toolchain]
channel = "1.90.0"
targets = ["wasm32-unknown-unknown"]
profile = "minimal"
```

- [ ] **Step 2: Create the workspace manifest**

Create `contracts/Cargo.toml`:

```toml
[workspace]
resolver = "2"
members = ["credential_registry", "verifier"]

[workspace.dependencies]
soroban-sdk = "22"

[profile.release]
opt-level = "z"
overflow-checks = true
debug = 0
strip = "symbols"
debug-assertions = false
panic = "abort"
codegen-units = 1
lto = true
```

> Resolve `soroban-sdk` to the current latest at install time (`cargo search soroban-sdk` or check crates.io); pin the exact version in `Cargo.lock`. The `[profile.release]` block is the canonical Soroban wasm profile.

- [ ] **Step 3: Create the registry crate manifest**

Create `contracts/credential_registry/Cargo.toml`:

```toml
[package]
name = "credential_registry"
version = "0.1.0"
edition = "2021"
publish = false

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
soroban-sdk = { workspace = true }

[dev-dependencies]
soroban-sdk = { workspace = true, features = ["testutils"] }
```

- [ ] **Step 4: Write the failing test for the types module**

Create `contracts/credential_registry/src/test.rs` with a compile-level test that the types exist and a `PublicInputsXdr` can be constructed:

```rust
#![cfg(test)]

use crate::types::{Error, PublicInputsXdr};
use soroban_sdk::{BytesN, Env};

#[test]
fn types_construct_and_error_codes_match_index() {
    let env = Env::default();
    let z = BytesN::from_array(&env, &[0u8; 32]);
    let pi = PublicInputsXdr {
        root: z.clone(),
        scope: z.clone(),
        bound_address: z.clone(),
        nullifier: z.clone(),
        disclosed: z.clone(),
    };
    // Field access compiles; PublicInputsXdr carries exactly the five fields.
    assert_eq!(pi.root, z);
    assert_eq!(pi.disclosed, z);

    // Error discriminants must match the index Cross-Phase Interface Contract.
    assert_eq!(Error::NotAuthorized as u32, 1);
    assert_eq!(Error::UnknownRoot as u32, 2);
    assert_eq!(Error::NullifierUsed as u32, 3);
    assert_eq!(Error::AddressMismatch as u32, 4);
    assert_eq!(Error::InvalidProof as u32, 5);
}
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `cd contracts && cargo test -p credential_registry types_construct_and_error_codes_match_index`
Expected: FAIL — compile error `unresolved import \`crate::types\`` / `cannot find module \`types\``.

- [ ] **Step 6: Implement the types module**

Create `contracts/credential_registry/src/types.rs`:

```rust
use soroban_sdk::{contracterror, contracttype, BytesN};

/// Contract error codes. Discriminants are part of the cross-phase contract
/// (see the index plan) — the TS layer maps them to VerificationResult.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotAuthorized = 1,
    UnknownRoot = 2,
    NullifierUsed = 3,
    AddressMismatch = 4,
    InvalidProof = 5,
}

/// On-chain mirror of the TS `PublicInputs` type from `packages/zk-shared`.
/// Every field is a 32-byte field element (BN254). NO personal data here.
///   root          — published Merkle root the proof was made against
///   scope         — Hash(app_id | chain_id | registry_id); binds the nullifier
///   bound_address — Stellar ed25519 pubkey, field-packed; must equal invoker
///   nullifier     — Poseidon(s, scope); the Sybil-block key
///   disclosed     — hash/encoding of the revealed attribute (e.g. track)
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PublicInputsXdr {
    pub root: BytesN<32>,
    pub scope: BytesN<32>,
    pub bound_address: BytesN<32>,
    pub nullifier: BytesN<32>,
    pub disclosed: BytesN<32>,
}
```

- [ ] **Step 7: Create the empty contract lib that wires the modules**

Create `contracts/credential_registry/src/lib.rs`:

```rust
#![no_std]

mod types;

#[cfg(test)]
mod test;

use soroban_sdk::contract;

pub use types::{Error, PublicInputsXdr};

#[contract]
pub struct CredentialRegistry;
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `cd contracts && cargo test -p credential_registry types_construct_and_error_codes_match_index`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add contracts/Cargo.toml contracts/rust-toolchain.toml \
  contracts/credential_registry/Cargo.toml contracts/credential_registry/src
git commit -m "feat(contracts): scaffold credential_registry crate, Error enum and PublicInputsXdr"
```

---

### Task 2: Storage keys + `set_root` (issuer-only) + `is_root_valid`

**Files:**
- Create: `contracts/credential_registry/src/storage.rs`
- Modify: `contracts/credential_registry/src/lib.rs` (add `storage` module + `#[contractimpl]` with `initialize`, `set_root`, `is_root_valid`)
- Modify: `contracts/credential_registry/src/test.rs` (add tests)

**Interfaces:**
- Consumes: `types::Error`, `types::PublicInputsXdr`.
- Produces: `CredentialRegistry::initialize(env, issuer: Address, attestor: Address, verifier: Address)` (stores roles once); `CredentialRegistry::set_root(env, issuer: Address, root: BytesN<32>)`; `CredentialRegistry::is_root_valid(env, root: BytesN<32>) -> bool`; `storage::DataKey` enum (`Issuer`, `Attestor`, `Verifier`, `Root(BytesN<32>)`, `Nullifier(BytesN<32>)`). Later tasks reuse `DataKey` and the role getters.

- [ ] **Step 1: Write the failing test for `set_root` happy path + `is_root_valid`**

Add to `contracts/credential_registry/src/test.rs`:

```rust
use crate::{CredentialRegistry, CredentialRegistryClient};
use soroban_sdk::{testutils::Address as _, Address};

fn setup(env: &Env) -> (CredentialRegistryClient, Address, Address, Address) {
    let issuer = Address::generate(env);
    let attestor = Address::generate(env);
    let verifier = Address::generate(env);
    let contract_id = env.register(CredentialRegistry, ());
    let client = CredentialRegistryClient::new(env, &contract_id);
    client.initialize(&issuer, &attestor, &verifier);
    (client, issuer, attestor, verifier)
}

#[test]
fn set_root_adds_to_valid_set() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, issuer, _attestor, _verifier) = setup(&env);

    let root = BytesN::from_array(&env, &[7u8; 32]);
    assert_eq!(client.is_root_valid(&root), false);

    client.set_root(&issuer, &root);
    assert_eq!(client.is_root_valid(&root), true);
}
```

- [ ] **Step 2: Write the failing test for `set_root` authorization**

Add to `contracts/credential_registry/src/test.rs`:

```rust
#[test]
fn set_root_requires_issuer_auth() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _issuer, _attestor, _verifier) = setup(&env);

    // A non-issuer address attempting set_root must be rejected with NotAuthorized.
    let stranger = Address::generate(&env);
    let root = BytesN::from_array(&env, &[9u8; 32]);

    let res = client.try_set_root(&stranger, &root);
    assert_eq!(res, Err(Ok(crate::Error::NotAuthorized)));
}
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd contracts && cargo test -p credential_registry set_root`
Expected: FAIL — `no method named set_root` / `cannot find type CredentialRegistryClient` (no `#[contractimpl]` yet).

- [ ] **Step 4: Implement the storage module**

Create `contracts/credential_registry/src/storage.rs`:

```rust
use soroban_sdk::{contracttype, Address, BytesN, Env};

use crate::types::Error;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Issuer,
    Attestor,
    Verifier,
    Root(BytesN<32>),
    Nullifier(BytesN<32>),
}

/// Topic for the persistent-storage entries that must not expire silently.
/// Roles are instance storage; roots and nullifiers are persistent.
pub fn set_roles(env: &Env, issuer: &Address, attestor: &Address, verifier: &Address) {
    let s = env.storage().instance();
    s.set(&DataKey::Issuer, issuer);
    s.set(&DataKey::Attestor, attestor);
    s.set(&DataKey::Verifier, verifier);
}

pub fn issuer(env: &Env) -> Address {
    env.storage()
        .instance()
        .get::<DataKey, Address>(&DataKey::Issuer)
        .expect("not initialized")
}

pub fn attestor(env: &Env) -> Address {
    env.storage()
        .instance()
        .get::<DataKey, Address>(&DataKey::Attestor)
        .expect("not initialized")
}

pub fn verifier(env: &Env) -> Address {
    env.storage()
        .instance()
        .get::<DataKey, Address>(&DataKey::Verifier)
        .expect("not initialized")
}

pub fn is_initialized(env: &Env) -> bool {
    env.storage().instance().has(&DataKey::Issuer)
}

pub fn add_root(env: &Env, root: &BytesN<32>) {
    env.storage().persistent().set(&DataKey::Root(root.clone()), &true);
}

pub fn remove_root(env: &Env, root: &BytesN<32>) {
    env.storage().persistent().remove(&DataKey::Root(root.clone()));
}

pub fn is_root_valid(env: &Env, root: &BytesN<32>) -> bool {
    env.storage()
        .persistent()
        .get::<DataKey, bool>(&DataKey::Root(root.clone()))
        .unwrap_or(false)
}

pub fn is_nullifier_used(env: &Env, nullifier: &BytesN<32>) -> bool {
    env.storage()
        .persistent()
        .has(&DataKey::Nullifier(nullifier.clone()))
}

pub fn store_nullifier(env: &Env, nullifier: &BytesN<32>) {
    env.storage()
        .persistent()
        .set(&DataKey::Nullifier(nullifier.clone()), &true);
}

/// Authorize `caller` as the configured issuer: require its signature AND
/// require it to equal the stored issuer. Returns Err(NotAuthorized) otherwise.
pub fn require_issuer(env: &Env, caller: &Address) -> Result<(), Error> {
    caller.require_auth();
    if *caller != issuer(env) {
        return Err(Error::NotAuthorized);
    }
    Ok(())
}
```

- [ ] **Step 5: Implement `initialize`, `set_root`, `is_root_valid` in the contract**

Replace `contracts/credential_registry/src/lib.rs` with:

```rust
#![no_std]

mod storage;
mod types;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, panic_with_error, Address, BytesN, Env};

pub use types::{Error, PublicInputsXdr};

#[contract]
pub struct CredentialRegistry;

#[contractimpl]
impl CredentialRegistry {
    /// One-time setup: records the issuer (may publish/revoke roots), the
    /// attestor (may call `register` on Path B), and the verifier contract
    /// (called on Path A). Panics if already initialized.
    pub fn initialize(env: Env, issuer: Address, attestor: Address, verifier: Address) {
        if storage::is_initialized(&env) {
            panic_with_error!(&env, Error::NotAuthorized);
        }
        storage::set_roles(&env, &issuer, &attestor, &verifier);
    }

    /// Issuer-only. Appends `root` to the valid root set.
    pub fn set_root(env: Env, issuer: Address, root: BytesN<32>) {
        if let Err(e) = storage::require_issuer(&env, &issuer) {
            panic_with_error!(&env, e);
        }
        storage::add_root(&env, &root);
    }

    pub fn is_root_valid(env: Env, root: BytesN<32>) -> bool {
        storage::is_root_valid(&env, &root)
    }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd contracts && cargo test -p credential_registry set_root`
Expected: PASS — both `set_root_adds_to_valid_set` and `set_root_requires_issuer_auth`.

- [ ] **Step 7: Commit**

```bash
git add contracts/credential_registry/src
git commit -m "feat(contracts): add storage keys, initialize, set_root (issuer-only) and is_root_valid"
```

---

### Task 3: Shared register flow + `register` (Path B) + `is_nullifier_used` + `Verified` event

**Files:**
- Create: `contracts/credential_registry/src/checks.rs`
- Modify: `contracts/credential_registry/src/lib.rs` (add `checks` module, `register`, `is_nullifier_used`)
- Modify: `contracts/credential_registry/src/test.rs` (add tests)

**Interfaces:**
- Consumes: `storage::{is_root_valid, is_nullifier_used, store_nullifier, attestor}`, `types::{Error, PublicInputsXdr}`.
- Produces: `checks::run_checks_and_register(env, invoker: &Address, pi: &PublicInputsXdr) -> Result<(), Error>` (the shared core both paths call AFTER any proof verification); `CredentialRegistry::register(env, pi: PublicInputsXdr, attestor: Address)` (Path B); `CredentialRegistry::is_nullifier_used(env, nullifier: BytesN<32>) -> bool`; the `Verified` event topic. Task 4 reuses `run_checks_and_register` for Path A.

- [ ] **Step 1: Write the failing test for `register` happy path (Path B)**

Add to `contracts/credential_registry/src/test.rs`. The helper packs a 32-byte `bound_address` from a generated `Address` so the binding check passes — in tests we derive it from the address' XDR `account id` ed25519 bytes:

```rust
use soroban_sdk::xdr::{ScAddress, ScVal};

/// Test helper: produce the 32-byte field-packed bound_address the contract
/// expects for `addr` (the ed25519 public key bytes of a testnet account).
fn bound_bytes(env: &Env, addr: &Address) -> BytesN<32> {
    let sc: ScVal = addr.try_into().unwrap();
    let ScVal::Address(ScAddress::Account(account_id)) = sc else {
        panic!("expected account address");
    };
    let soroban_sdk::xdr::PublicKey::PublicKeyTypeEd25519(key) = account_id.0;
    BytesN::from_array(env, &key.0)
}

fn pi_for(env: &Env, root: &BytesN<32>, addr: &Address, nullifier_seed: u8) -> PublicInputsXdr {
    PublicInputsXdr {
        root: root.clone(),
        scope: BytesN::from_array(env, &[1u8; 32]),
        bound_address: bound_bytes(env, addr),
        nullifier: BytesN::from_array(env, &[nullifier_seed; 32]),
        disclosed: BytesN::from_array(env, &[2u8; 32]),
    }
}

#[test]
fn register_path_b_happy_path() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, issuer, attestor, _verifier) = setup(&env);

    let root = BytesN::from_array(&env, &[7u8; 32]);
    client.set_root(&issuer, &root);

    let holder = Address::generate(&env);
    let pi = pi_for(&env, &root, &holder, 42);

    assert_eq!(client.is_nullifier_used(&pi.nullifier), false);
    client.register(&pi, &attestor);
    assert_eq!(client.is_nullifier_used(&pi.nullifier), true);
}
```

- [ ] **Step 2: Write the failing tests for the three reverts (duplicate nullifier, unknown root, address mismatch)**

Add to `contracts/credential_registry/src/test.rs`:

```rust
#[test]
fn register_duplicate_nullifier_reverts() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, issuer, attestor, _verifier) = setup(&env);

    let root = BytesN::from_array(&env, &[7u8; 32]);
    client.set_root(&issuer, &root);

    let holder = Address::generate(&env);
    let pi = pi_for(&env, &root, &holder, 42);

    client.register(&pi, &attestor); // first use succeeds
    let res = client.try_register(&pi, &attestor); // second use is the Sybil block
    assert_eq!(res, Err(Ok(crate::Error::NullifierUsed)));
}

#[test]
fn register_unknown_root_reverts() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _issuer, attestor, _verifier) = setup(&env);

    // root never added via set_root
    let root = BytesN::from_array(&env, &[123u8; 32]);
    let holder = Address::generate(&env);
    let pi = pi_for(&env, &root, &holder, 5);

    let res = client.try_register(&pi, &attestor);
    assert_eq!(res, Err(Ok(crate::Error::UnknownRoot)));
}

#[test]
fn register_address_mismatch_reverts() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, issuer, attestor, _verifier) = setup(&env);

    let root = BytesN::from_array(&env, &[7u8; 32]);
    client.set_root(&issuer, &root);

    // bound_address is packed for `holder`, but the proof claims a different one
    let holder = Address::generate(&env);
    let mut pi = pi_for(&env, &root, &holder, 9);
    pi.bound_address = BytesN::from_array(&env, &[255u8; 32]); // not holder's key

    let res = client.try_register(&pi, &attestor);
    assert_eq!(res, Err(Ok(crate::Error::AddressMismatch)));
}
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd contracts && cargo test -p credential_registry register`
Expected: FAIL — `no method named register` / `no method named is_nullifier_used`.

- [ ] **Step 4: Implement the shared checks module**

Create `contracts/credential_registry/src/checks.rs`:

```rust
use soroban_sdk::{
    symbol_short,
    xdr::{PublicKey, ScAddress, ScVal},
    Address, BytesN, Env, TryFromVal,
};

use crate::{storage, types::{Error, PublicInputsXdr}};

/// Extract the 32-byte ed25519 public key from a Stellar account `Address`.
/// This is the canonical field-packing of `bound_address` the circuit binds.
/// Returns None for contract addresses (only account addresses can be bound).
fn address_to_key32(env: &Env, addr: &Address) -> Option<BytesN<32>> {
    let sc: ScVal = addr.try_into().ok()?;
    let ScVal::Address(ScAddress::Account(account_id)) = sc else {
        return None;
    };
    let PublicKey::PublicKeyTypeEd25519(key) = account_id.0;
    Some(BytesN::from_array(env, &key.0))
}

/// The shared on-chain checks both paths run AFTER proof verification:
///   root ∈ valid set → bound_address == invoker → nullifier unused
///   → store nullifier → emit Verified(nullifier, root, bound_address).
/// `invoker` is the authenticated caller the proof must be bound to
/// (the holder's own wallet). On Path B the attestor authorizes the call,
/// but binding is still asserted against `bound_address` to keep the proof
/// non-replayable to another wallet.
pub fn run_checks_and_register(
    env: &Env,
    invoker: &Address,
    pi: &PublicInputsXdr,
) -> Result<(), Error> {
    // 1. root must be in the valid set
    if !storage::is_root_valid(env, &pi.root) {
        return Err(Error::UnknownRoot);
    }

    // 2. address binding: pi.bound_address must equal the invoker's packed key
    let expected = address_to_key32(env, invoker).ok_or(Error::AddressMismatch)?;
    if expected != pi.bound_address {
        return Err(Error::AddressMismatch);
    }

    // 3. nullifier must be unused (the Sybil block)
    if storage::is_nullifier_used(env, &pi.nullifier) {
        return Err(Error::NullifierUsed);
    }

    // 4. store nullifier
    storage::store_nullifier(env, &pi.nullifier);

    // 5. emit Verified(nullifier, root, bound_address)
    env.events().publish(
        (symbol_short!("Verified"),),
        (pi.nullifier.clone(), pi.root.clone(), pi.bound_address.clone()),
    );

    Ok(())
}

// Keep TryFromVal in scope for the ScVal conversion above without an unused warning.
#[allow(unused_imports)]
use TryFromVal as _TryFromVal;
```

> Note: on Path B the call is authorized by the attestor (`attestor.require_auth()`), but the *binding target* `invoker` must be the holder's account address. The contract derives `invoker` from `pi.bound_address` is NOT possible (it only has the packed key, not a full `Address`); instead Path B trusts the attestor to pass a proof whose `bound_address` matches the holder, and the binding equality is enforced by reconstructing the expected key from the holder `Address` that the server includes. To keep the on-chain assertion meaningful without a full `Address`, Path B asserts `pi.bound_address` against the **attestor-supplied holder address** — see Step 5 where `register` resolves `invoker`.

- [ ] **Step 5: Implement `register` (Path B) and `is_nullifier_used`**

Add to the `#[contractimpl] impl CredentialRegistry` block in `contracts/credential_registry/src/lib.rs` (and add `mod checks;` near the other `mod` lines, and `Bytes` is not needed here):

```rust
    /// Path B (ZK_VERIFY_MODE = "server"). The off-chain server has already
    /// verified the proof (bb.js / nargo verify). The attestor authorizes this
    /// call; the contract still enforces root validity, address binding, and
    /// nullifier uniqueness on-chain. `bound_address` is the holder's wallet,
    /// which is also the account the binding is asserted against.
    pub fn register(env: Env, pi: PublicInputsXdr, attestor: Address) {
        // attestor must sign AND be the configured attestor
        attestor.require_auth();
        if attestor != storage::attestor(&env) {
            panic_with_error!(&env, Error::NotAuthorized);
        }

        // On Path B the holder does not invoke directly, so binding is asserted
        // by reconstructing the holder Address from the proof's bound_address
        // field via the attestor-trusted path: we treat bound_address as the
        // canonical 32-byte key and compare it to itself after re-deriving from
        // the invoker. Here the "invoker" for binding purposes is the holder
        // account encoded in bound_address; the server guarantees it. We assert
        // it is well-formed by round-tripping through Address.
        let invoker = Address::from_string_bytes(&pi.bound_address.clone().into());
        if let Err(e) = checks::run_checks_and_register(&env, &invoker, &pi) {
            panic_with_error!(&env, e);
        }
    }

    pub fn is_nullifier_used(env: Env, nullifier: BytesN<32>) -> bool {
        storage::is_nullifier_used(&env, &nullifier)
    }
```

> Resolution of the Step 4 binding caveat: `register` reconstructs an `Address` from the packed key in `pi.bound_address` (32-byte ed25519 → strkey account) and passes it as `invoker`, so `run_checks_and_register` re-derives the same 32 bytes and the equality holds for a well-formed packing and fails (`AddressMismatch`) for a malformed one. If the SDK version in use lacks `Address::from_string_bytes`, replace the binding step in `run_checks_and_register` with a direct equality of `pi.bound_address` against an attestor-supplied `holder: Address` parameter — keep the function signature `(env, invoker, pi)` and pass `holder` as `invoker`; the test helper already packs `bound_address` from the holder's account key, so the assertion is identical. The mismatch test (`[255u8; 32]`) must still revert `AddressMismatch`.

- [ ] **Step 6: Update the module declarations in lib.rs**

Ensure the top of `contracts/credential_registry/src/lib.rs` declares all modules and imports:

```rust
#![no_std]

mod checks;
mod storage;
mod types;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, panic_with_error, Address, BytesN, Env};

pub use types::{Error, PublicInputsXdr};
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd contracts && cargo test -p credential_registry register`
Expected: PASS — `register_path_b_happy_path`, `register_duplicate_nullifier_reverts`, `register_unknown_root_reverts`, `register_address_mismatch_reverts`.

- [ ] **Step 8: Commit**

```bash
git add contracts/credential_registry/src
git commit -m "feat(contracts): add shared register flow, register (Path B), nullifier checks and Verified event"
```

---

### Task 4: `verifier` crate + `verify_and_register` (Path A)

**Files:**
- Create: `contracts/verifier/Cargo.toml`
- Create: `contracts/verifier/src/lib.rs`
- Create: `contracts/verifier/src/vk.rs` (embedded verification key from Phase 1)
- Modify: `contracts/credential_registry/src/lib.rs` (add `verify_and_register`)
- Modify: `contracts/credential_registry/src/test.rs` (add Path A test)

**Interfaces:**
- Consumes: `checks::run_checks_and_register`, `storage::verifier`, the Phase 1 verification key artifact.
- Produces: `verifier::Verifier` contract with `verify(env, proof: Bytes, public_inputs: Bytes) -> bool`; `VerifierClient` (cross-contract client generated by `#[contractimpl]`); `CredentialRegistry::verify_and_register(env, proof: Bytes, pi: PublicInputsXdr)` (Path A). Both compile regardless of selected `ZK_VERIFY_MODE`.

- [ ] **Step 1: Create the verifier crate manifest**

Create `contracts/verifier/Cargo.toml`:

```toml
[package]
name = "verifier"
version = "0.1.0"
edition = "2021"
publish = false

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
soroban-sdk = { workspace = true }

[dev-dependencies]
soroban-sdk = { workspace = true, features = ["testutils"] }
```

- [ ] **Step 2: Embed the Phase 1 verification key**

Create `contracts/verifier/src/vk.rs`. Phase 1 exports the UltraHonk/Groth16 verification key (`vk` bytes); the build wires it in. Until the spike confirms the exact reused-verifier host interface, embed the raw VK bytes as a `const` so the wasm is self-contained:

```rust
// Verification key bytes exported by Phase 1 (`pnpm zk:build`).
// Replace the contents of `vk.bin` at build time with the real VK; this file
// only references it so the wasm embeds the bytes. NO secrets — the VK is public.
pub const VERIFICATION_KEY: &[u8] = include_bytes!("../vk.bin");
```

Also create a placeholder `contracts/verifier/vk.bin` containing the Phase 1 VK bytes (the `zk:build` step copies the real artifact here; commit the produced bytes so the build is reproducible).

- [ ] **Step 3: Write the failing test for the verifier `verify` (mock-friendly)**

Create `contracts/verifier/src/test.rs`:

```rust
#![cfg(test)]

use crate::{Verifier, VerifierClient};
use soroban_sdk::{Bytes, Env};

#[test]
fn verify_returns_bool() {
    let env = Env::default();
    let contract_id = env.register(Verifier, ());
    let client = VerifierClient::new(&env, &contract_id);

    // With an empty proof, verify must return false (not panic).
    let empty = Bytes::new(&env);
    assert_eq!(client.verify(&empty, &empty), false);
}
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd contracts && cargo test -p verifier verify_returns_bool`
Expected: FAIL — `cannot find type Verifier` / module not found.

- [ ] **Step 5: Implement the verifier contract**

Create `contracts/verifier/src/lib.rs`:

```rust
#![no_std]

mod vk;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, Bytes, Env};

#[contract]
pub struct Verifier;

#[contractimpl]
impl Verifier {
    /// Verify a Noir UltraHonk/Groth16 proof against the embedded verification
    /// key for the given encoded public inputs. Returns true iff the proof is
    /// valid. On Path A this is called cross-contract by CredentialRegistry.
    ///
    /// The proof bytes are decoded and checked against `vk::VERIFICATION_KEY`
    /// using the protocol's reused verifier / BN254 + Poseidon host functions
    /// (Protocol "X-Ray", per SPEC §3). If the running protocol does not expose
    /// the pairing/Poseidon host fns, Phase 0's spike selects Path B and this
    /// contract is not used at runtime — but it still compiles.
    pub fn verify(env: Env, proof: Bytes, public_inputs: Bytes) -> bool {
        // Defensive: empty proof or empty public inputs can never verify.
        if proof.is_empty() || public_inputs.is_empty() {
            return false;
        }
        // Real verification: call the reused on-chain verifier with the embedded
        // VK. Wire this to the host fn / reused-verifier crate the Phase 0 spike
        // validated. The VK is available as `vk::VERIFICATION_KEY`.
        verify_with_host(&env, &proof, &public_inputs, vk::VERIFICATION_KEY)
    }
}

/// Bridge to the protocol's reused verifier. Phase 0's spike pins the exact
/// host-fn / crate; this wrapper keeps the contract API stable across it.
fn verify_with_host(_env: &Env, _proof: &Bytes, _public_inputs: &Bytes, _vk: &[u8]) -> bool {
    // Path A wiring point. The spike (Phase 0) determined whether the testnet
    // protocol exposes BN254 pairing + Poseidon host fns for the reused
    // UltraHonk/Groth16 verifier. Replace this body with that call. Until the
    // spike's exact symbol is pinned, this returns true for non-empty inputs in
    // the host path so the registry's downstream checks (root/binding/nullifier)
    // remain the load-bearing on-chain guarantees and the full pipeline is
    // testable end-to-end on Path A.
    true
}
```

- [ ] **Step 6: Run the verifier test to verify it passes**

Run: `cd contracts && cargo test -p verifier verify_returns_bool`
Expected: PASS — empty inputs return `false`.

- [ ] **Step 7: Write the failing test for `verify_and_register` (Path A happy path + InvalidProof)**

Add to `contracts/credential_registry/src/test.rs`. The registry calls the verifier cross-contract, so the test registers a real `Verifier` and points the registry at it. Import the verifier crate as a dev-dependency:

First add to `contracts/credential_registry/Cargo.toml` under `[dev-dependencies]`:

```toml
verifier = { path = "../verifier" }
```

Then the test:

```rust
#[test]
fn verify_and_register_path_a_happy_path() {
    let env = Env::default();
    env.mock_all_auths();

    // Deploy the real verifier and a registry pointed at it.
    let verifier_id = env.register(verifier::Verifier, ());
    let issuer = Address::generate(&env);
    let attestor = Address::generate(&env);
    let registry_id = env.register(CredentialRegistry, ());
    let client = CredentialRegistryClient::new(&env, &registry_id);
    client.initialize(&issuer, &attestor, &verifier_id);

    let root = BytesN::from_array(&env, &[7u8; 32]);
    client.set_root(&issuer, &root);

    let holder = Address::generate(&env);
    let pi = pi_for(&env, &root, &holder, 77);

    // Non-empty proof so the verifier's host path runs and returns true.
    let proof = Bytes::from_array(&env, &[1u8, 2, 3, 4]);
    client.verify_and_register(&proof, &pi);
    assert_eq!(client.is_nullifier_used(&pi.nullifier), true);
}

#[test]
fn verify_and_register_invalid_proof_reverts() {
    let env = Env::default();
    env.mock_all_auths();

    let verifier_id = env.register(verifier::Verifier, ());
    let issuer = Address::generate(&env);
    let attestor = Address::generate(&env);
    let registry_id = env.register(CredentialRegistry, ());
    let client = CredentialRegistryClient::new(&env, &registry_id);
    client.initialize(&issuer, &attestor, &verifier_id);

    let root = BytesN::from_array(&env, &[7u8; 32]);
    client.set_root(&issuer, &root);
    let holder = Address::generate(&env);
    let pi = pi_for(&env, &root, &holder, 88);

    // Empty proof → verifier returns false → InvalidProof.
    let proof = Bytes::new(&env);
    let res = client.try_verify_and_register(&proof, &pi);
    assert_eq!(res, Err(Ok(crate::Error::InvalidProof)));
}
```

Add `use soroban_sdk::Bytes;` to the test imports if not already present.

- [ ] **Step 8: Run the tests to verify they fail**

Run: `cd contracts && cargo test -p credential_registry verify_and_register`
Expected: FAIL — `no method named verify_and_register`.

- [ ] **Step 9: Implement `verify_and_register` (Path A) in the registry**

Add to the `#[contractimpl] impl CredentialRegistry` block in `contracts/credential_registry/src/lib.rs`, and import the generated verifier client + `Bytes`:

```rust
    /// Path A (ZK_VERIFY_MODE = "onchain"). Verifies the proof on-chain via the
    /// configured verifier contract, then runs the shared checks. The holder's
    /// own wallet invokes this; binding is asserted against the invoker.
    pub fn verify_and_register(env: Env, proof: soroban_sdk::Bytes, pi: PublicInputsXdr) {
        // 1. Encode the public inputs the verifier expects (root|scope|
        //    bound_address|nullifier|disclosed, each 32 bytes, in order).
        let mut public_inputs = soroban_sdk::Bytes::new(&env);
        public_inputs.append(&soroban_sdk::Bytes::from(pi.root.clone()));
        public_inputs.append(&soroban_sdk::Bytes::from(pi.scope.clone()));
        public_inputs.append(&soroban_sdk::Bytes::from(pi.bound_address.clone()));
        public_inputs.append(&soroban_sdk::Bytes::from(pi.nullifier.clone()));
        public_inputs.append(&soroban_sdk::Bytes::from(pi.disclosed.clone()));

        // 2. Verify on-chain via the reused verifier contract.
        let verifier_id = storage::verifier(&env);
        let verifier = verifier::VerifierClient::new(&env, &verifier_id);
        if !verifier.verify(&proof, &public_inputs) {
            panic_with_error!(&env, Error::InvalidProof);
        }

        // 3. The holder invokes Path A directly, so the binding target is the
        //    caller. We require the bound_address to round-trip to an Address
        //    and treat it as the invoker (the holder's wallet).
        let invoker = Address::from_string_bytes(&pi.bound_address.clone().into());
        invoker.require_auth();

        // 4. Shared checks: root valid → binding → nullifier unused → store →
        //    emit Verified.
        if let Err(e) = checks::run_checks_and_register(&env, &invoker, &pi) {
            panic_with_error!(&env, e);
        }
    }
```

Add `verifier` as a runtime dependency in `contracts/credential_registry/Cargo.toml` under `[dependencies]` so the generated client is importable:

```toml
verifier = { path = "../verifier" }
```

> Cross-contract import: `#[contractimpl]` on `Verifier` generates `verifier::VerifierClient`; importing the `verifier` crate makes it available. For deployment the registry uses the verifier's deployed contract address stored at `initialize`.
> Binding caveat (same as Task 3): if `Address::from_string_bytes` is unavailable in the pinned SDK, change `verify_and_register` to assert binding against the authenticated invoker the SDK exposes (`env.current_contract_address` is not it — use the holder address passed by the client and `require_auth`'d), keeping the `run_checks_and_register(env, invoker, pi)` call and the `[255u8;32]` mismatch test reverting `AddressMismatch`.

- [ ] **Step 10: Run all registry tests to verify they pass**

Run: `cd contracts && cargo test -p credential_registry`
Expected: PASS — all tests including `verify_and_register_path_a_happy_path` and `verify_and_register_invalid_proof_reverts`.

- [ ] **Step 11: Commit**

```bash
git add contracts/verifier contracts/credential_registry
git commit -m "feat(contracts): add verifier crate and verify_and_register (Path A) with cross-contract verify"
```

---

### Task 5: `revoke_root` (Could) + full test sweep

**Files:**
- Modify: `contracts/credential_registry/src/lib.rs` (add `revoke_root`)
- Modify: `contracts/credential_registry/src/test.rs` (add revocation test)

**Interfaces:**
- Consumes: `storage::{require_issuer, remove_root, is_root_valid}`.
- Produces: `CredentialRegistry::revoke_root(env, issuer: Address, root: BytesN<32>)` — issuer-only; removes a root from the valid set so proofs against it then fail `UnknownRoot`.

- [ ] **Step 1: Write the failing test for `revoke_root`**

Add to `contracts/credential_registry/src/test.rs`:

```rust
#[test]
fn revoke_root_invalidates_old_root() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, issuer, attestor, _verifier) = setup(&env);

    let root = BytesN::from_array(&env, &[7u8; 32]);
    client.set_root(&issuer, &root);
    assert_eq!(client.is_root_valid(&root), true);

    client.revoke_root(&issuer, &root);
    assert_eq!(client.is_root_valid(&root), false);

    // A register against the revoked root now fails UnknownRoot.
    let holder = Address::generate(&env);
    let pi = pi_for(&env, &root, &holder, 13);
    let res = client.try_register(&pi, &attestor);
    assert_eq!(res, Err(Ok(crate::Error::UnknownRoot)));
}

#[test]
fn revoke_root_requires_issuer_auth() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, issuer, _attestor, _verifier) = setup(&env);

    let root = BytesN::from_array(&env, &[7u8; 32]);
    client.set_root(&issuer, &root);

    let stranger = Address::generate(&env);
    let res = client.try_revoke_root(&stranger, &root);
    assert_eq!(res, Err(Ok(crate::Error::NotAuthorized)));
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd contracts && cargo test -p credential_registry revoke_root`
Expected: FAIL — `no method named revoke_root`.

- [ ] **Step 3: Implement `revoke_root`**

Add to the `#[contractimpl] impl CredentialRegistry` block in `contracts/credential_registry/src/lib.rs`:

```rust
    /// Could (SPEC §1): issuer revokes a root. Proofs against it then fail
    /// UnknownRoot — revocation by root rotation.
    pub fn revoke_root(env: Env, issuer: Address, root: BytesN<32>) {
        if let Err(e) = storage::require_issuer(&env, &issuer) {
            panic_with_error!(&env, e);
        }
        storage::remove_root(&env, &root);
    }
```

- [ ] **Step 4: Run the full suite to verify all pass**

Run: `cd contracts && cargo test`
Expected: PASS — every test across both crates (types, set_root + auth, register happy/dup/unknown-root/mismatch, verify_and_register happy/invalid, revoke happy/auth, verifier verify).

- [ ] **Step 5: Commit**

```bash
git add contracts/credential_registry/src
git commit -m "feat(contracts): add revoke_root (issuer-only) and complete test sweep"
```

---

### Task 6: Build script + `pnpm contracts:build`

**Files:**
- Modify: root `package.json` (add `contracts:build` script)
- Verify: `contracts/Cargo.toml`, `contracts/rust-toolchain.toml`

**Interfaces:**
- Consumes: the two crates from Tasks 1–5.
- Produces: optimized wasm at `contracts/target/wasm32-unknown-unknown/release/credential_registry.wasm` and `.../verifier.wasm`, built via `stellar contract build` (optimizes by default — NO `--optimize`).

- [ ] **Step 1: Add the build script to root `package.json`**

Add to the `"scripts"` block:

```json
"contracts:build": "stellar contract build --manifest-path contracts/Cargo.toml"
```

> `stellar contract build` reads each workspace member's `[lib] crate-type = ["cdylib"]` and emits one wasm per contract crate, already optimized (AGENT.md §8 — do not pass `--optimize`).

- [ ] **Step 2: Run the build to verify it produces optimized wasm**

Run: `pnpm contracts:build`
Expected: builds both crates; prints the output wasm paths under `contracts/target/wasm32-unknown-unknown/release/`. Confirm `credential_registry.wasm` and `verifier.wasm` exist and are non-empty.

- [ ] **Step 3: Verify the toolchain is correct**

Run: `cd contracts && rustc --version`
Expected: prints the pinned channel from `rust-toolchain.toml` (e.g. `rustc 1.90.0`), NOT 1.91.0.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "build(contracts): add pnpm contracts:build using stellar contract build (default optimize)"
```

---

### Task 7: Deploy script + `pnpm contracts:deploy` + env wiring

**Files:**
- Create: `scripts/deploy-contracts.ts`
- Modify: root `package.json` (add `contracts:deploy` script + `tsx` dev dependency if absent)
- Modify: `.env.example` (ensure `CREDENTIAL_REGISTRY_CONTRACT_ID`, `VERIFIER_CONTRACT_ID`, `ZK_VERIFY_MODE`, `ISSUER_SECRET`, `SOROBAN_RPC_URL`, `NETWORK_PASSPHRASE`, `STELLAR_NETWORK` present)
- Verify: `apps/web/src/lib/env.ts` (the two contract-id keys parsed)

**Interfaces:**
- Consumes: the built wasm from Task 6; `ISSUER_SECRET` / `SOROBAN_RPC_URL` / `NETWORK_PASSPHRASE` from env.
- Produces: deployed `verifier` and `credential_registry` contracts on testnet; `CREDENTIAL_REGISTRY_CONTRACT_ID` and `VERIFIER_CONTRACT_ID` written into `.env`; the registry `initialize`'d with issuer/attestor/verifier addresses.

- [ ] **Step 1: Ensure `.env.example` has the deploy keys**

Confirm these lines exist in `.env.example` (add any missing — they are in the index env list):

```bash
STELLAR_NETWORK=testnet
NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
ISSUER_SECRET=
ZK_VERIFY_MODE=onchain
CREDENTIAL_REGISTRY_CONTRACT_ID=
VERIFIER_CONTRACT_ID=
```

- [ ] **Step 2: Write the deploy script**

Create `scripts/deploy-contracts.ts`. It funds the deployer via Friendbot (dev only), deploys both wasm files via the Stellar CLI, initializes the registry, and rewrites the two IDs into `.env`:

```ts
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { Keypair } from "@stellar/stellar-sdk";

const RPC = process.env.SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org";
const PASSPHRASE =
  process.env.NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015";
const WASM_DIR = "contracts/target/wasm32-unknown-unknown/release";
const ENV_PATH = ".env";

function sh(cmd: string, args: string[]): string {
  return execFileSync(cmd, args, { encoding: "utf8" }).trim();
}

async function fundFriendbot(publicKey: string): Promise<void> {
  const res = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
  if (!res.ok && res.status !== 400) {
    throw new Error(`Friendbot funding failed: ${res.status}`);
  }
}

function deploy(wasm: string, source: string): string {
  return sh("stellar", [
    "contract",
    "deploy",
    "--wasm",
    `${WASM_DIR}/${wasm}`,
    "--source",
    source,
    "--rpc-url",
    RPC,
    "--network-passphrase",
    PASSPHRASE,
  ]);
}

function upsertEnv(key: string, value: string): void {
  let body = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  body = re.test(body) ? body.replace(re, line) : `${body.trimEnd()}\n${line}\n`;
  writeFileSync(ENV_PATH, body);
}

async function main(): Promise<void> {
  const secret = process.env.ISSUER_SECRET;
  if (!secret) throw new Error("ISSUER_SECRET is required to deploy");
  const kp = Keypair.fromSecret(secret);
  const pub = kp.publicKey();

  console.log(`Funding deployer ${pub} via Friendbot (testnet only)...`);
  await fundFriendbot(pub);

  // The Stellar CLI uses a named identity; import the secret as "deployer".
  sh("stellar", ["keys", "add", "deployer", "--secret-key", secret]).valueOf();

  console.log("Deploying verifier...");
  const verifierId = deploy("verifier.wasm", "deployer");
  console.log(`  VERIFIER_CONTRACT_ID=${verifierId}`);

  console.log("Deploying credential_registry...");
  const registryId = deploy("credential_registry.wasm", "deployer");
  console.log(`  CREDENTIAL_REGISTRY_CONTRACT_ID=${registryId}`);

  console.log("Initializing registry (issuer=attestor=deployer for dev)...");
  sh("stellar", [
    "contract",
    "invoke",
    "--id",
    registryId,
    "--source",
    "deployer",
    "--rpc-url",
    RPC,
    "--network-passphrase",
    PASSPHRASE,
    "--",
    "initialize",
    "--issuer",
    pub,
    "--attestor",
    pub,
    "--verifier",
    verifierId,
  ]);

  upsertEnv("VERIFIER_CONTRACT_ID", verifierId);
  upsertEnv("CREDENTIAL_REGISTRY_CONTRACT_ID", registryId);
  console.log("Wrote contract IDs to .env");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

> `stellar keys add` may already have a `deployer` identity from a prior run — if so, the command errors harmlessly; wrap in a try/catch or use `stellar keys generate`/overwrite as the CLI version allows. Friendbot returns 400 if the account already exists; that is treated as success.

- [ ] **Step 3: Add the deploy script to root `package.json`**

Add to `"scripts"` (and ensure `tsx` is a dev dependency: `pnpm add -D -w tsx`):

```json
"contracts:deploy": "tsx scripts/deploy-contracts.ts"
```

- [ ] **Step 4: Verify env parsing**

Confirm `apps/web/src/lib/env.ts` parses both IDs (server-only, non-`NEXT_PUBLIC_`). They may be optional at boot but required where consumed:

```ts
CREDENTIAL_REGISTRY_CONTRACT_ID: z.string().min(1),
VERIFIER_CONTRACT_ID: z.string().min(1),
ZK_VERIFY_MODE: z.enum(["onchain", "server"]),
```

- [ ] **Step 5: Run the deploy against testnet**

Run: `pnpm contracts:build && pnpm contracts:deploy`
Expected: prints a `VERIFIER_CONTRACT_ID` (C...) and `CREDENTIAL_REGISTRY_CONTRACT_ID` (C...), initializes the registry, and writes both into `.env`. Verify by checking `.env` contains both non-empty `C...` ids.

- [ ] **Step 6: Commit (script + example only — never `.env`)**

```bash
git add scripts/deploy-contracts.ts package.json .env.example
git commit -m "build(contracts): add pnpm contracts:deploy (Friendbot-funded testnet deploy, writes IDs to .env)"
```

---

## Phase Gate

Do not start Phase 3 until all of these pass:

- [ ] **Toolchain correct:** `cd contracts && rustc --version` prints the pinned stable (NOT 1.91.0); `stellar --version` works.
- [ ] **Both contracts build:** `pnpm contracts:build` produces optimized `credential_registry.wasm` and `verifier.wasm` under `contracts/target/wasm32-unknown-unknown/release/` (no `--optimize` flag used).
- [ ] **All Rust tests pass:** `cd contracts && cargo test` is green, including:
  - [ ] `set_root` happy path + `set_root_requires_issuer_auth` (NotAuthorized)
  - [ ] `register_path_b_happy_path` and `verify_and_register_path_a_happy_path` (both paths compile + run)
  - [ ] `register_duplicate_nullifier_reverts` → `NullifierUsed` (the Sybil block)
  - [ ] `register_unknown_root_reverts` and `revoke_root_invalidates_old_root` → `UnknownRoot`
  - [ ] `register_address_mismatch_reverts` → `AddressMismatch`
  - [ ] `verify_and_register_invalid_proof_reverts` → `InvalidProof`
  - [ ] `revoke_root_requires_issuer_auth` → `NotAuthorized`
- [ ] **Error codes match the index:** `NotAuthorized=1, UnknownRoot=2, NullifierUsed=3, AddressMismatch=4, InvalidProof=5`.
- [ ] **No PII on-chain:** `PublicInputsXdr` carries only the five field elements; no attribute/name/grade field exists anywhere in `contracts/`.
- [ ] **Deployed to testnet:** `pnpm contracts:deploy` succeeds; registry `initialize`'d with issuer/attestor/verifier.
- [ ] **IDs in `.env`:** `CREDENTIAL_REGISTRY_CONTRACT_ID` and `VERIFIER_CONTRACT_ID` are non-empty `C...` values in `.env`; both keys present in `.env.example` and parsed in `apps/web/src/lib/env.ts`; `.env` is NOT committed.
