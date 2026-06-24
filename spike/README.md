# Phase 0 ZK on-chain verification spike

This directory contains throwaway artifacts for the `ZK_VERIFY_MODE` decision gate
(issue #6). The spike asks: can a Noir UltraHonk proof be verified inside a Soroban
contract on Stellar testnet today?

**Verdict: Path B (`server`).** Soroban testnet (protocol 27 / stellar-cli 27.0.0)
does not expose BN254 pairing or Poseidon host functions, so an UltraHonk proof
cannot be verified on-chain. The server will verify proofs via bb.js and only the
nullifier + Merkle root will be recorded on-chain.

---

## Toolchain actually used

| Tool | Requested in plan | Used here | Reason |
|------|-------------------|-----------|--------|
| nargo | 1.0.0-beta.22 | 1.0.0-beta.22 | via noirup |
| bb CLI | matching bb.js 4.3.x | 5.0.0-nightly.20260522 | `bbup --noir-version 1.0.0-beta.22` resolved to this version |
| @aztec/bb.js | 4.3.0 | 5.0.0-nightly.20260522 | Matched the installed bb CLI |
| Rust | 1.90.0 | 1.92.0 | stellar-cli 27 blocks 1.91; soroban-sdk 26 needs ≥1.91; 1.92 + `wasm32v1-none` builds successfully |
| stellar-cli | latest | 27.0.0 | installed via Homebrew |

## Circuit

```bash
cd circuits/zelyo_credential
nargo compile
```

Output:

```text
[zelyo_credential] Circuit witness successfully solved
[zelyo_credential] Witness saved to target/zelyo_credential.gz
```

> The plan's `std::hash::poseidon::bn254` import does not exist in beta.22. We used
> `poseidon = { tag = "v0.3.0", git = "https://github.com/noir-lang/poseidon" }`
> and imported `::poseidon::poseidon::bn254`.

## Local proof generation

```bash
cd spike
pnpm install --ignore-workspace
pnpm proof
```

Output:

```text
Generated proof for circuit with 3 public inputs and 458 fields.
[spike] local bb.js verifyProof = true
[spike] wrote proof.json + vk
```

> `generate-proof.ts` reads the witness from `circuits/zelyo_credential/target/zelyo_credential.gz`
> (produced by `nargo execute`) because bb.js 5.x expects the msgpack-inside-gzip witness format,
> not the raw Uint8Array returned by `@noir-lang/noir_js`.

## Throwaway Soroban verifier

```bash
cd spike/verifier
stellar contract build
```

Output:

```text
Wasm File: target/wasm32v1-none/release/spike_verifier.wasm (840 bytes optimized ...)
Exported Functions: 1 found
  • verify
✅ Build Complete
```

The contract body only touches `env.crypto()` and returns `false`. There is no
Soroban host function for BN254 pairing or Poseidon verification, so a real
on-chain verifier cannot be implemented today.

## Testnet deploy + invoke

```bash
stellar keys generate --network testnet spike
stellar keys fund spike --network testnet

cd spike/verifier
stellar contract deploy \
  --wasm target/wasm32v1-none/release/spike_verifier.wasm \
  --source spike --network testnet
# CCAEQ2HMODDII6UIPSFKEOZ7WWM3Z3NOYBISZZ4S57WVGOOYY3CGPFPP

stellar contract invoke --id CCAEQ2HMODDII6UIPSFKEOZ7WWM3Z3NOYBISZZ4S57WVGOOYY3CGPFPP \
  --source spike --network testnet --send=yes \
  -- verify --proof <PROOF_HEX> --vk <VK_HEX> --public_inputs '["...","...","..."]'
```

Output:

```text
✅ Transaction submitted successfully!
🔗 https://stellar.expert/explorer/testnet/tx/e60fba5531eb96a50c0368c56e91aa024fe4a7abe937e413ae35c00b494f3aa9
false
```

## Evidence summary

- `nargo compile`: ✅ succeeded
- bb.js local `verifyProof`: ✅ `true`
- `spike_verifier` build: ✅ succeeded (Rust 1.92.0, wasm32v1-none)
- testnet deploy: ✅ `CCAEQ2HMODDII6UIPSFKEOZ7WWM3Z3NOYBISZZ4S57WVGOOYY3CGPFPP`
- on-chain `verify(valid proof)`: ❌ returned `false` (no BN254/Poseidon host primitive)
- tx hash: `e60fba5531eb96a50c0368c56e91aa024fe4a7abe937e413ae35c00b494f3aa9`
