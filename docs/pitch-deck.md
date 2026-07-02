# Zelyo — Hackathon Pitch Deck

> ZK-backed verifiable credentials on Stellar. Prove one fact without revealing who you are.
>
> This deck is grounded in `SPEC.md`, the shipped codebase (`apps/web`, `circuits`, `contracts`, `packages/zk-shared`), `docs/features.md`, and `docs/REMAINING_TASKS.md`. Claims confirmed from code/spec are unmarked; anything inferred is tagged `[inferred]`. Target talk length: 3–5 minutes.

---

## Slide 1: Title

# Zelyo

**Seal a credential. Prove one fact. Reveal nothing else.**

*ZK-backed verifiable credentials on Stellar — the chain records only a nullifier, never who you are.*

- **Team:** Team Zelyo — `[team name placeholder]`
- **Stack:** Noir · UltraHonk · Stellar Soroban · Next.js 16
- **Repo:** `[repo URL placeholder]` · **Live demo:** `[demo URL placeholder]` [inferred]

![Placeholder: hero cover — Zelyo wordmark on warm-paper background with the foil-stamp seal and the tagline "Seal a credential. Prove one fact. Reveal nothing else."](placeholder-image.png)

**Speaker notes:**
Hi, we're Team Zelyo, and we're building a privacy layer for credentials on Stellar. The one-line pitch is right there on the slide: seal a credential, prove one fact, reveal nothing else. Today, proving you're qualified means handing over your whole identity — a diploma PDF, a passport scan, a transcript — and trusting whoever you sent it to. Zelyo replaces that with a zero-knowledge proof of exactly one fact, sealed to your wallet, and the only thing that ever touches the chain is an anonymous nullifier. Over the next few minutes I'll show you the problem, a live demo, how it actually works under the hood, and where we go next.

---

## Slide 2: Problem

**Proving you're qualified today costs you your privacy.**

- **Over-disclosure** — every job application, KYC check, or badge forces you to hand over *full* documents, resumes, or IDs to prove a single fact.
- **Centralized honeypots** — platforms stockpile PII that becomes a breach target; one leak and your identity is gone.
- **Slow, expensive trust** — verifying a credential means calling a third party, waiting on an email, or trusting a screenshot.
- **No user control** — once you share a PDF diploma or passport scan, you lose control over who sees it, forever.

![Placeholder: side-by-side contrast — left: "today" a pile of exposed documents (diploma, ID, transcript) with redaction lines; right: "with Zelyo" a single sealed envelope showing only "track = Data Engineering ✓"](placeholder-image.png)

**Speaker notes:**
The problem is simple and personal. If you've ever applied for a job, you've emailed a full transcript to a stranger just to prove you took one course. That's over-disclosure — you reveal everything to prove one thing. Every platform that collects that data is a centralized honeypot waiting to be breached, and the moment you share a scan, you lose control of it forever. Verification itself is slow and manual: someone calls a registrar, waits for an email, or just trusts a screenshot. For freelancers, remote workers, anyone crossing borders, the cost of proving you're qualified is privacy itself. Zelyo exists to make that cost zero.

---

## Slide 3: Solution

**Zelyo lets an issuer mint a credential and a holder prove one fact about it in zero-knowledge — the chain records only a nullifier, never who you are.**

- **In-browser ZK proving** — the holder generates an UltraHonk proof on their own device; their secret `s` never leaves the browser.
- **On-chain Sybil resistance** — a Soroban registry stores the Merkle root and enforces nullifier uniqueness, so one credential can only register once per app.
- **Selective disclosure + money-rails** — reveal only `track`; a valid proof unlocks a Stellar-native reward (a claimable XLM balance or a verified flag) at a gated job board.

![Placeholder: three-pillar diagram — "Prove in browser" (laptop icon) → "Nullifier on-chain" (Soroban contract icon) → "Unlock reward" (Stellar coin icon)](placeholder-image.png)

**Speaker notes:**
Here's the solution in one sentence: an issuer mints a credential, the holder proves one fact about it in zero-knowledge, and the chain records only a nullifier — never who they are. Three things make that real. First, the proof is generated entirely in the holder's browser with Noir and Barretenberg's UltraHonk prover; their identity secret never leaves the device. Second, a Soroban smart contract is the source of truth for the Merkle root and for nullifier uniqueness, which gives us on-chain Sybil resistance — you can't reuse the same credential twice. Third, selective disclosure is wired to real money-rails: reveal just your track, and a valid proof unlocks a Stellar-native reward at a gated job board. One fact proven, nothing else leaked, a real reward delivered.

---

## Slide 4: Demo

**The core flow: mint → prove → reveal → claim.**

1. **Mint (issuer/admin)** — `/issuer/mint`: enter learner name, track, grade, issue date → leaf inserted into a depth-20 Merkle tree → root published on-chain via `set_root` → Verifiable Credential sealed to S3. A typewriter log streams each step: `RESOLVE_HOLDER → BUILD_LEAF → INSERT_LEAF → PUBLISH_ROOT → WRITE_VC → SEALED`.
2. **Keys + wallet (holder)** — `/wallet/keys`: WebCrypto generates the secret `s` locally, persists it AES-GCM encrypted in IndexedDB, and publishes only `idCommitment = Poseidon(s)`. `s` is never sent to the server.
3. **Prove (holder)** — `/wallet/prove/[id]`: toggle disclosure (default: `track` only), enter your Stellar address + vault passphrase, press the foil-stamp **Generate ZK-Proof** button → UltraHonk proof built in-browser → `POST /api/verify`.
4. **Reveal** — `/verify/result/[txHash]`: the "nothing personal on-chain" panel — nullifier + bound address + a Stellar Expert explorer link. **Zero PII.** Re-proving the same credential returns `NULLIFIER_USED` (the live Sybil block).
5. **Claim (anyone → holder)** — `/jobs/data-engineering`: **Prove with Zelyo** carries the gate through the prove flow and loops back → **Claim Your Reward** → `claimGate` checks the disclosed `track` matches the gate predicate → issues a native-XLM claimable balance.

![Placeholder: 5-frame storyboard screenshot strip — /issuer/mint mint form with typewriter log, /wallet/keys foil-stamp seal, /wallet/prove selective-disclosure checkboxes + Generate ZK-Proof button, /verify/result ExplorerRevealPanel showing nullifier + explorer link, /jobs/[slug] ClaimPanel "Reward Unlocked"](placeholder-image.png)

[PLACEHOLDER: Demo video — ~90-second screen recording of the full spine: admin mints a "Data Engineering" credential → holder generates keys → holder toggles only `track`, binds their Stellar address, generates the proof in-browser (show the typewriter prove log) → reveal page shows the nullifier and the explorer link with no PII → second attempt shows NULLIFIER_USED → holder claims the gate reward. Target length 75–105s.]

**Speaker notes:**
This is the spine of the product, and it's the actual acceptance criteria from our spec. An admin mints a credential — name, track, grade, date — and a typewriter log narrates each cryptographic step as the leaf is built, inserted into the Merkle tree, the root published on-chain, and the VC sealed. The holder generates their identity key in-browser — the secret `s` is encrypted in IndexedDB and never touches a server. Then the magic: on the prove page they toggle to reveal only their track, bind their Stellar address, and hit the foil-stamp button. The UltraHonk proof is generated right there in the browser and submitted. The result page shows the on-chain transaction — just a nullifier and a bound address, with a link to the explorer — and zero personal data. Try to prove the same credential again and the chain rejects it with NULLIFIER_USED, our live Sybil block. Finally, the holder claims the job-gate reward, and a real native-XLM claimable balance is issued to their wallet.

---

## Slide 5: How it works

**Three trust roles, one Soroban registry, proving on the holder's device.**

```
ISSUER (admin)              HOLDER (browser + wallet)        VERIFIER (job board)
 Next.js issuer portal       Next.js wallet UI                Next.js public gate
 └ build leaf, insert         ├ holds secret s (local only)   └ posts reward gates
   into server Merkle tree     ├ Noir + bb.js prover (WASM)      → holder claims reward
 └ publish root on-chain ──┐  └ generate proof, submit ──┐
                            ▼                              ▼
                  STELLAR · SOROBAN — CredentialRegistry
                    ├ set_root (issuer-only)        ├ register (Path B): attestor signs,
                    ├ is_root_valid                  │  enforces root-valid + address-binding
                    ├ nullifier set (Sybil block)    │  + nullifier-uniqueness on-chain
                    └ revoke_root (Could)            └ verify_and_register (Path A, stubbed)
```

- **Stack (confirmed in `package.json`):** Next.js 16.2 · React 19.2 · TypeScript 6.0.3 · Tailwind v4 · Prisma 7.8 + PostgreSQL 16 · Auth.js v5 (argon2id) · Redis + rate-limiter-flexible · S3-compatible storage · Noir 1.0.0-beta.22 · `@aztec/bb.js` 5.0.0-nightly (UltraHonk) · `@zk-kit/imt` Merkle · `@zkpassport/poseidon2` · Stellar `@stellar/stellar-sdk` 16.0.1 · Soroban (Rust `soroban-sdk` 26.1, protocol 27) · Vitest 4 + Playwright + axe.
- **The circuit** (`circuits/zelyo_credential/src/main.nr`): depth-20 Merkle inclusion + `nullifier == Poseidon(s, scope)` + `disclosed == Poseidon(track)` + non-zero `bound_address`. Poseidon2 throughout; JS builders in `@zelyo/zk-shared` are proven bit-identical to the circuit via a frozen parity-vector fixture.
- **Verification — honest reality (Path B):** proofs are generated and verified off-chain with `bb.js` `UltraHonkVerifierBackend`; a server attestor then calls `register()` on Soroban, which **on-chain** enforces root validity, address binding, and nullifier uniqueness. Pure on-chain ZK verification (Path A) is stubbed — Stellar protocol 27 lacks the BN254 pairing/Poseidon host functions required, per our Phase 0 decision doc.

![Placeholder: architecture diagram — the ASCII flow above rendered as a clean line-art schematic with the "DATA → HASH → PROOF / ROOT" ledger-line motif from BRAND.md](placeholder-image.png)

**Speaker notes:**
The architecture has three trust roles connected through one Soroban registry. The issuer is an admin in our Next.js portal who builds a Merkle leaf and publishes the root on-chain. The holder keeps their secret `s` only in their browser and generates the proof in-browser with Noir and bb.js — no trusted server ever sees the witness. The verifier posts reward gates. Under the hood we're on a fully modern stack: Next.js 16, React 19, TypeScript 6, Prisma and Postgres, Noir and UltraHonk for ZK, and Soroban on Stellar. The Noir circuit proves Merkle inclusion, a scope-bound nullifier, selective disclosure of track, and address binding — and our shared Poseidon2 library is verified bit-for-bit identical to the circuit. One honest caveat, because we won't hide it: on-chain ZK proof verification isn't possible on Stellar testnet yet — protocol 27 lacks the BN254 host functions — so we verify the proof off-chain with bb.js and the contract still enforces the load-bearing guarantees on-chain: root validity, address binding, and nullifier uniqueness. That's a documented decision, not a shortcut.

---

## Slide 6: Impact / market

**Who needs this, and why.**

- **Issuers** (universities, bootcamps, certifiers) — mint fraud-resistant credentials and publish roots to a public registry *without* running a PII database. No honeypot to breach.
- **Holders** (freelancers, remote workers, professionals crossing borders) — carry proof of skills in a wallet; reveal only what each opportunity requires. Self-sovereign: they hold the secret.
- **Verifiers** (employers, marketplaces, DAOs) — confirm a claim cryptographically with **no PII liability** and no manual checks; pay rewards directly to a bound wallet.
- **Developers** — a full-stack, working scaffold (Noir circuit + Soroban contracts + Next.js app + shared ZK lib) to extend with new gates, credentials, and reward types.

> A credential today is a liability: a file you can't un-share. Zelyo turns it into a portable, provable, private asset. `[inferred]` market sizing and go-to-market figures are intentionally omitted — we'd rather show a working system than a fabricated TAM.

![Placeholder: four-quadrant audience map — Issuers / Holders / Verifiers / Developers with one-line value props each](placeholder-image.png)

**Speaker notes:**
Four groups need this. Issuers — a university or bootcamp — can mint tamper-proof credentials and publish roots to a public registry without keeping a database of personal details, which means there's no honeypot to breach. Holders — freelancers, remote workers, anyone crossing borders — get to carry proof of their skills and reveal only what a specific opportunity requires, and they hold their own secret, so it's genuinely self-sovereign. Verifiers — employers, marketplaces, DAOs — confirm claims cryptographically with zero PII liability and can pay a reward straight to the bound wallet. And developers get a real, working scaffold — circuit, contracts, app, and shared ZK library — to build new gates and credential types on top. The deeper shift: today a credential is a liability, a file you can't un-share. Zelyo turns it into a portable, private, provable asset. We've left market-size numbers off the slide on purpose — a working system is more honest than a fabricated TAM.

---

## Slide 7: What's next

**Honest gaps between the spec and the shipped implementation** (from `docs/REMAINING_TASKS.md`).

- **Selective disclosure is `track`-only (BLOCKER).** The circuit binds a single `disclosed = Poseidon(track)`; the 5 prove checkboxes and the gate-form dropdown over-promise. Generalizing to Track / Grade / Issue Date needs a circuit recompile with a disclosure-mask input + `@zelyo/zk-shared` + `ProvePanel` updates. Until then, demo gates stay single-predicate on `track`.
- **Reward isn't actually spendable yet.** `createClaimableBalance` only *locks* funds; the holder has no in-app `claimClaimableBalance` step, and `ClaimPanel` prints "Reward Unlocked" without confirming final status. Need a claim step or a direct `payment` op.
- **Native XLM unreachable via the form.** `GateForm` forces an issuer, so it can only ever produce a credit asset; native XLM works via the API but not the UI. Need an "XLM (native)" option aligned with the API/service schema.
- **Path A on-chain verification** — the `Verifier` contract returns `true`; wire the real host-fn call when Stellar adds BN254 pairing/Poseidon primitives.
- **Could-scope items still open:** range/date predicate, verifier-chosen trusted issuers, binding `credentialId` and the claim-to-its-gate server-side, plus mint-log SSE race (switch to Redis Streams) and a Railway prod smoke test.

![Placeholder: roadmap timeline — Now (track-only disclosure, Path B, claimable-balance lock) → Next (multi-attribute disclosure, spendable reward, native-XLM form) → Later (on-chain Path A verify, revocation UX, gate marketplace)](placeholder-image.png)

**Speaker notes:**
We keep a public remaining-tasks doc, and these are the honest gaps. The biggest one: selective disclosure is currently track-only — our circuit binds exactly one disclosed attribute, so the five checkboxes you'll see on the prove page are aspirational until we recompile the circuit with a disclosure mask. Until then, demo gates are single-predicate on track, and we say so in the UI rather than fake it. Second, the reward isn't truly spendable yet: we create a claimable balance that locks funds for the holder, but there's no in-app step to actually claim them, and the panel doesn't confirm final status. Third, native XLM can't be created through the form even though it works through the API — a schema mismatch we'll fix. And the on-chain ZK verification path is stubbed, awaiting Stellar protocol support for the BN254 host functions. Beyond those, the spec's "Could" items — range predicates, trusted-issuer sets, tighter claim binding — are our roadmap. We lead with what's real.

---

## Slide 8: Team / thanks

**Team Zelyo**

| Name | Role | Contact |
|------|------|---------|
| `[team member 1 — placeholder]` | `[role — e.g. ZK circuits & contracts]` | `[GitHub / email]` |
| `[team member 2 — placeholder]` | `[role — e.g. web app & UX]` | `[GitHub / email]` |
| `[team member 3 — placeholder]` | `[role — e.g. product & design]` | `[GitHub / email]` |

**Thanks to** — Noir & Aztec (bb.js / UltraHonk), the Stellar / Soroban team, `@zkpassport/poseidon2`, `@zk-kit`, and the open-source privacy-infrastructure community.

**Links:** repo `[repo URL placeholder]` · demo `[demo URL placeholder]` · docs `docs/features.md`, `docs/REMAINING_TASKS.md`, `docs/DEPLOY.md`

![Placeholder: team photo or avatar row placeholder](placeholder-image.png)

**Speaker notes:**
That's Zelyo — privacy-preserving credentials, sealed with the gravity of a printed record. We're a small team and we've left placeholders here for names and roles, but what we built is real and running: a Noir circuit with verified Poseidon parity, Soroban contracts with on-chain Sybil resistance, and a full Next.js app with in-browser proving and a live reward flow. Huge thanks to Noir and Aztec for the proving stack, the Stellar and Soroban teams, zkpassport and zk-kit for the crypto primitives, and the broader privacy-infrastructure community. We'd love to talk to issuers, verifiers, and anyone who wants to build on this. Privacy is the default — let's make it the standard. Thank you.

---

# Recording Script

> A continuous, readable script for recording the pitch (~4 minutes spoken). Cover this top-to-bottom; do not read the slides verbatim — the slides are the visuals.

---

"Hi — we're Team Zelyo, and we're here to fix something that's been quietly broken for a long time: the way you prove you're qualified.

Think about the last time you applied for anything. You emailed a stranger your full transcript to prove you took one course. You uploaded a passport scan to prove you're over eighteen. Every platform that collects that information is a honeypot waiting to be breached — and the moment you hit send, you lose control of your identity forever. Verification is slow, it's manual, and it's expensive, because the only way we know to trust a credential is to see all of it. For freelancers, for remote workers, for anyone crossing a border, the cost of proving you're qualified is your privacy itself.

Zelyo is our answer. One sentence: an issuer mints a credential, the holder proves one fact about it in zero-knowledge, and the only thing the chain ever records is a nullifier — never who they are. Three pieces make that real. The proof is generated entirely in the holder's browser, with Noir and UltraHonk, so their secret never leaves the device. A Soroban smart contract is the source of truth for the Merkle root and for nullifier uniqueness, which gives us on-chain Sybil resistance — you cannot reuse the same credential twice. And selective disclosure is wired to real money-rails: reveal just your track, and a valid proof unlocks a Stellar-native reward at a gated job board.

Let me walk you through it. An admin logs in and mints a credential — learner name, track, grade, issue date. A typewriter log narrates each cryptographic step as the leaf is built, inserted into a depth-twenty Merkle tree, the root published on-chain, and the Verifiable Credential sealed to storage. The holder then generates their identity key in-browser — the secret `s` is encrypted locally and never sent to a server; only a public commitment is published. Now the magic moment. On the prove page, the holder toggles to reveal only their track, enters their Stellar address, and presses the foil-stamp button. The zero-knowledge proof is generated right there in the browser and submitted. The result page shows the on-chain transaction — just a nullifier and a bound address, with a link to the explorer — and zero personal data. Try to prove the same credential a second time and the chain rejects it with NULLIFIER_USED. That's our live Sybil block. Finally, the holder claims the job-gate reward, and a real native-XLM claimable balance is issued to their wallet.

Under the hood, it's a fully modern stack: Next.js sixteen, React nineteen, TypeScript six, Prisma and Postgres, Noir and UltraHonk for the zero-knowledge layer, and Soroban on Stellar for the registry. The Noir circuit proves Merkle inclusion, a scope-bound nullifier, selective disclosure, and address binding — and our shared Poseidon2 library is verified bit-for-bit identical to the circuit. One thing we won't hide: on-chain ZK proof verification isn't possible on Stellar testnet yet — protocol twenty-seven doesn't expose the pairing and Poseidon host functions — so we verify the proof off-chain with bb.js, and the contract still enforces the load-bearing guarantees on-chain: root validity, address binding, and nullifier uniqueness. That's a documented architectural decision, not a shortcut.

Who's this for? Issuers — a university or bootcamp — mint fraud-resistant credentials without keeping a database of personal details, so there's no honeypot to breach. Holders carry proof of their skills and reveal only what each opportunity requires, and they hold their own secret, so it's genuinely self-sovereign. Verifiers confirm claims cryptographically with zero PII liability and can pay a reward straight to a bound wallet. And developers get a real, working scaffold to build on.

We keep a public list of what's left, and we'll be honest about it. Selective disclosure is currently track-only — our circuit binds exactly one disclosed attribute, so until we recompile it with a disclosure mask, the extra checkboxes are aspirational, and we say so in the UI rather than fake it. The reward creates a claimable balance that locks funds, but there's no in-app step to actually claim them yet. Native XLM works through the API but not through the form, a schema mismatch we'll fix. And the on-chain verification path is stubbed, waiting on Stellar protocol support for the BN254 host functions. The rest — range predicates, trusted-issuer sets, a gate marketplace — is our roadmap.

The deeper shift is this: today a credential is a liability — a file you can't un-share. Zelyo turns it into a portable, private, provable asset. We'd love to talk to issuers, verifiers, and anyone who wants to build on this. Privacy is the default — let's make it the standard. Thank you."