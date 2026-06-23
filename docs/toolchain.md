# Zelyo local toolchain (Phase 0)

These tools live outside the pnpm workspace and are installed once per machine.
Versions are pinned per Global Constraints. Re-verify availability before use.

## 1. Noir (nargo 1.0.0-beta.22) + Barretenberg (bb)

```bash
# install noirup (the Noir toolchain manager)
curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
# new shell, then pin the exact version
noirup --version 1.0.0-beta.22
nargo --version            # expect: nargo version = 1.0.0-beta.22

# install Barretenberg's bb CLI (proving backend, UltraHonk)
curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/master/barretenberg/bbup/install | bash
# new shell, then install the bb that pairs with bb.js 4.3.x
bbup --version 0.x          # pin to the bb release matching @aztec/bb.js 4.3.x (check the bb.js release notes)
bb --version
```

The JS proving libs (`@noir-lang/noir_js`, `@noir-lang/noir_wasm` beta.22,
`@aztec/bb.js` 4.3.x) are pnpm dependencies, added by the spike (Task 6) and Phase 1 — not installed here.

## 2. Rust + soroban-sdk (PIN Rust 1.90.0)

AGENT.md §8: **Rust 1.91.0 has wasm build issues and is blocked by the Stellar CLI.**
Pin a compatible toolchain for contract builds.

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# new shell
rustup toolchain install 1.90.0
rustup default 1.90.0
rustup target add wasm32-unknown-unknown   # soroban contracts compile to wasm
rustc --version                              # expect: rustc 1.90.0
```

Pin the toolchain in the repo so contract builds are reproducible — create
`rust-toolchain.toml` at the contracts root in Phase 2:

```toml
[toolchain]
channel = "1.90.0"
targets = ["wasm32-unknown-unknown"]
```

`soroban-sdk` is a Cargo dependency declared in each contract's `Cargo.toml`
(Phase 2), pinned to the latest release compatible with the testnet protocol.

## 3. Stellar CLI (latest)

```bash
cargo install --locked stellar-cli       # or: brew install stellar-cli
stellar --version
```

`stellar contract build` optimizes wasm by default (AGENT.md §8) — do NOT pass `--optimize`.

## 4. Testnet account funding (Friendbot, dev only)

```bash
# generate a throwaway testnet keypair
stellar keys generate --network testnet spike
stellar keys address spike                # prints the G... public key
# fund it
stellar keys fund spike --network testnet
# (equivalently) curl "https://friendbot.stellar.org/?addr=<G_ADDRESS>"
```
