# Zelyo — Pitch Deck Guide

> Presenter's companion to [`docs/pitch-deck-v3.pptx`](./pitch-deck-v3.pptx). This guide holds the slide-by-slide talk track (mirroring the deck's speaker notes), the three themes judges/investors care about most — **Stellar ecosystem impact, ecosystem integrations, and go-to-market** — and a Q&A guide for live sessions.
>
> Content is grounded in `SPEC.md`, the current-state `README.md`, and the Stellar ecosystem research in **GitHub issue [#108](https://github.com/webnxt-2030/zelyo/issues/108)** (H1 2026). Confidence caveats from #108 are preserved — verify the items flagged *medium-confidence* before external use.

---

## How to use this guide

- **Deck:** `docs/pitch-deck-v3.pptx` — 14 slides, each with speaker notes embedded.
- **This file:** the narrative spine + rebuttal material. Read the "Talk track" before presenting; keep the "Q&A guide" open during the session.
- **One-liner (memorize):** *Zelyo lets anyone prove a single fact about a credential — "I'm a certified Data Engineer", "I'm KYC-verified", "I'm over 18" — without revealing the underlying document or their identity, natively on Stellar.*
- **The three things the deck must prove:** (1) Zelyo fills a real gap — Stellar has **no privacy-preserving identity layer**; (2) the **timing** is exceptional — Stellar shipped the exact crypto we need in Protocol 25/26 (Jan–May 2026); (3) there's a concrete, staged path to **revenue and ecosystem impact**, starting in the Philippines.

---

## Deck at a glance

| # | Slide | Purpose |
|---|-------|---------|
| 1 | Cover | Identity + one-liner |
| 2 | Problem | Proving yourself is all-or-nothing |
| 3 | Solution | Three privacy properties |
| 4 | How it works | Mint → Prove → Verify → Reward |
| 5 | **Why now** | Stellar shipped our core primitive |
| 6 | **Ecosystem impact** | The identity layer Stellar is missing |
| 7 | **Ecosystem integrations** | Built to compose with Stellar |
| 8 | Integration roadmap | Sequenced by impact × readiness |
| 9 | Market | One primitive, many markets |
| 10 | **Go-to-market** | Philippines → APAC → Global |
| 11 | Business model | How Zelyo makes money |
| 12 | Competition | An early, open category |
| 13 | The ask | Fund the wedge, capture the standard |
| 14 | Closing | Prove one fact. Reveal nothing else. |

---

## Talk track (slide by slide)

### 1 · Cover
Open with the one-liner. Frame the three proofs above. Note the deck is grounded in issue #108 and the live codebase; visual theme follows `BRAND.md`.

### 2 · Problem
Put the audience in the user's shoes: a Filipino overseas worker onboarding to a remittance app or foreign employer must hand over a full passport scan, diploma, or proof of address — repeatedly, to every counterparty, each of whom now holds their PII. The same pain appears in crypto: airdrops get drained by Sybil bots because there's no way to prove "one real person" without collecting identity. **This is not a niche crypto problem — it's the universal KYC/credential problem, and today's answer (photograph your documents and hope) is both a privacy disaster and a fraud vector.**

### 3 · Solution
The "aha": instead of "hand over everything and trust them to delete it," Zelyo says *"present a cryptographic proof of exactly one fact."* Walk the three properties: **self-sovereign** (secret stays client-side), **selective disclosure** (reveal one attribute, bound to your wallet), **nothing personal on-chain** (only a nullifier + bound address). The nullifier is the clever bit — a deterministic, unlinkable token `Poseidon(secret, scope)` that enforces "one use per person per app" (Sybil resistance) *without ever knowing who the person is*. That single property is what makes reusable-KYC and bot-proof airdrops possible.

### 4 · How it works
Four steps: **Mint** (issuer → Merkle leaf → root on-chain), **Prove** (UltraHonk ZK proof in-browser; witness never leaves the device), **Verify** (registry enforces root validity, address binding, nullifier uniqueness on Soroban), **Reward** (job gate releases a Stellar-native reward, Sybil-blocked from double claims). Be honest about maturity: the full spine works today via **Path B** (verify off-chain, register on-chain); fully on-chain verification (**Path A**) is wired but stubbed — the next slide explains why that's about to become trivial.

### 5 · Why now  ⭐
The timing slide — arguably the most important for a Stellar audience.
- **Protocol 25 "X-Ray"** (validator vote Jan 22, 2026) — Stellar's first major privacy milestone — added **native BN254** curve ops (CAP-74) and **native Poseidon/Poseidon2** hashing (CAP-75).
- **Protocol 26 "Yardstick"** — live on mainnet **May 6, 2026** — added more BN254 functions + precise TTL control for cheaply storing nullifiers/roots.
- **Noir proves on BN254** — the exact curve Stellar now accelerates — so on-chain proof verification + Poseidon Merkle checks become a single host call, no protocol changes. A pairing check that costs tens of millions of Wasm instructions elsewhere is a single host call on Soroban.
- Two public reference implementations (Interstellar; an UltraHonk-on-Soroban verifier) already prove feasibility, and SDF is actively marketing "real-world ZK" and "KYC on Stellar."
- *Caveat:* confirm the exact fee/rent economics on testnet before over-promising (flagged in #108).

### 6 · Impact to the Stellar ecosystem  ⭐ (required theme)
Reframe from "our product" to "what Stellar gains." Stellar is superb at payments but has **no privacy-preserving identity/reputation primitive** — Zelyo supplies one, and it's composable. Four impact vectors:
1. **Sybil-resistant airdrops & rewards** — gate campaigns to one-proof-per-real-person without collecting identity; kills bot farming.
2. **Reusable KYC for anchors** — prove "KYC-verified / over-18 / EU-resident" once, reuse everywhere via ZK; no PII re-sent (SEP-12).
3. **Privacy-first eligibility for DeFi & DAOs** — Blend, Soroswap and governance can check attributes without doxxing users.
4. **Showcases Soroban beyond payments** — a flagship, non-financial use of the BN254/Poseidon host functions, exactly SDF's 2026 privacy narrative.

**Strategic pitch to SDF:** Zelyo doesn't extract value from the ecosystem — it creates a shared standard that makes anchors, wallets and DeFi more valuable *and* drives Soroban transaction volume. That's why it's a strong Stellar Community Fund candidate.

### 7 · Ecosystem integrations  ⭐ (required theme)
The "we're not building in a vacuum" slide. Zelyo plugs into what already exists on Stellar:
- **SEPs** — SEP-10/45 for wallet & smart-wallet sign-in; **SEP-12 is THE reusable-KYC hook**; SEP-8 lets a reward asset only move to verified addresses; SEP-38 quotes; SEP-7 deep links.
- **Soroban host functions** — the P25/P26 BN254 + Poseidon (and P22 BLS12-381) primitives that make on-chain verification (Path A) real.
- **Anchors** — the Anchor Platform, USDC (Circle) and MoneyGram (which added **MGUSD** in June 2026) are both a distribution channel and the *customer* for reusable KYC.
- **Wallets** — passkey-kit gives seedless biometric keys; Launchtube can sponsor fees so a user needs zero XLM to claim a reward.
- **DEX / DeFi** — path payments deliver a reward in the holder's preferred asset; Blend / Soroswap are token-gating customers.
- *Caveat:* SEP-45 is Draft and Launchtube is a no-SLA prototype — position these as near-term, not shipped.

### 8 · Integration roadmap
The ranked plan from #108, ordered by impact × readiness:
1. **Ship Path A** (on-chain ZK verify) using P25/P26 host functions — converts our core differentiator from stubbed to real.
2. **Reusable-KYC for anchors (SEP-12)** — "prove KYC once"; the largest B2B revenue wedge.
3. **Passkey smart-wallet + SEP-45 + Launchtube** — seed-free, gasless holder UX.
4. **SEP-8 token-gated rewards + DeFi composability** (Blend / Soroswap) — the natural SCF Integration story.
5. **Author a `did:stellar` / on-chain-VC SEP** — no incumbent standard; be the reference implementation.

### 9 · Market
One primitive, many markets — don't get boxed as "just diplomas." Lead with education (easiest to explain, our seeded demo), but the biggest TAM is **reusable KYC**. The **EU eIDAS 2** rollout (through 2026) legislates selective-disclosure credentials into existence — validating the category and creating compliance-driven demand.

### 10 · Go-to-market  ⭐ (required theme)
Land-and-expand, three tiers:
- **Philippines (beachhead).** Ideal market: one of the world's largest remittance economies (MoneyGram is already a major Stellar anchor, MGUSD live June 2026), a huge OFW population that repeatedly submits KYC, a booming freelancer/BPO workforce proving skills to foreign clients, and a bootcamp/TESDA certifier base for the issuer side. Regulatory momentum via BSP eKYC and the national digital ID. Win a few anchors + issuers here → reference market.
- **APAC (expansion).** Replicate along SEA remittance and migrant-worker corridors (PH → Singapore / Japan / Australia / Middle East) — same reusable-KYC and credential pains; grow through anchor and wallet partnerships.
- **Global (scale).** Become the reusable-KYC standard for anchors and exchanges worldwide, ride EU eIDAS 2, and lock category leadership by authoring the `did:stellar` / VC SEP and shipping a developer platform (SDKs, gate templates).

**Investor takeaway:** not PH-only — a **PH-first wedge into a global standard**, the trajectory SDF and investors want to see.

### 11 · Business model
Layered: **Issuer SaaS** (near-term, low-friction entry) → **Reusable-KYC B2B** (the high-margin engine — anchors/fintechs pay per verification to avoid re-collecting KYC) → **Gate & campaign take-rates** (airdrop gating) → **Grants & ecosystem** (SCF Build Award up to $150K + SDF partnerships de-risk the early build). Moat: once anchors share a nullifier/attestation standard through us, there are network effects and switching costs. *Wedge = issuance (PH). Engine = reusable-KYC (APAC/Global). Moat = the shared standard.*

### 12 · Competition
Be candid: **Luminar** is the closest competitor (client-side ZK proof of KYC → a soulbound token; Poseidon2 nullifiers) — its existence validates the category. Differentiate: Luminar issues essentially one "I'm KYC'd" badge; Zelyo proves **arbitrary attributes** from a real credential with selective disclosure, and closes the loop with issuer tooling + gated rewards. Against Web2 identity (Onfido/Persona/Jumio): they *are* the honeypot model we replace. The open-standards gap (no ratified Stellar DID/VC) is the strategic prize. *Verify Luminar's exact current feature set before the meeting — #108 flags it medium-confidence.*

### 13 · The ask
Milestone-based. Blend non-dilutive (**SCF 7.0 Build Award** — up to $150K XLM over four milestone tranches, 6-week rounds) with a seed raise to fund the PH beachhead and the ZK/Soroban team. Near-term proof points investors can hold us to: ship Path A, fix reward delivery (issues [#103](https://github.com/webnxt-2030/zelyo/issues/103)/[#104](https://github.com/webnxt-2030/zelyo/issues/104)), close the failing acceptance test ([#101](https://github.com/webnxt-2030/zelyo/issues/101)), land 3–5 issuers + an anchor pilot. Use of funds: ZK + Soroban engineering, PH/APAC BD, security audit, compliance.

### 14 · Closing
Tagline + trajectory (PH-first, globally aimed). CTA: live demo (mint → prove → verify → claim) + back the SCF application / seed round. **Replace the bracketed contact placeholders before sending.**

---

## Reference links (leave-behind)

All sourced in issue [#108](https://github.com/webnxt-2030/zelyo/issues/108):
- [Announcing Stellar X-Ray, Protocol 25](https://stellar.org/blog/developers/announcing-stellar-x-ray-protocol-25) · [Yardstick, Protocol 26](https://stellar.org/blog/foundation-news/yardstick-stellar-protocol-26)
- CAP-59 (BLS12-381), CAP-74 (BN254), CAP-75 (Poseidon) — [stellar-protocol/core](https://github.com/stellar/stellar-protocol/tree/master/core)
- SEP index — [stellar-protocol/ecosystem](https://github.com/stellar/stellar-protocol/tree/master/ecosystem) · [SEP-12 KYC](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0012.md) · [SEP-45](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0045.md) · [SEP-8](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0008.md)
- [Anchor Platform](https://developers.stellar.org/docs/learn/fundamentals/anchors) · [MoneyGram case study](https://stellar.org/case-studies/moneygram-international) · [Smart Wallets](https://developers.stellar.org/docs/build/apps/smart-wallets) · [passkey-kit](https://github.com/kalepail/passkey-kit) · [Launchtube](https://github.com/stellar/launchtube)
- [SCF v7](https://stellar.org/blog/ecosystem/introducing-scf-v7) · [communityfund.stellar.org](https://communityfund.stellar.org/) · [Messari — State of Stellar Q1 2026](https://messari.io/report/state-of-stellar-q1-2026)
- [SDF — 5 Real-World Zero-Knowledge Use Cases](https://stellar.org/blog/developers/5-real-world-zero-knowledge-use-cases)

---

## Q&A guide (judges & investors)

Grouped by theme. Answers are honest about current maturity (see the codebase and `docs/REMAINING_TASKS.md`).

### Product & technology

**Q1. What exactly does Zelyo do, in one sentence?**
It lets a holder prove a single fact about a verifiable credential — e.g. "I completed the Data Engineering track" — with a zero-knowledge proof, revealing nothing else and recording only a nullifier + wallet address on Stellar.

**Q2. Is this live? What actually works today?**
The full mint → prove → verify → claim spine works end-to-end on testnet via "Path B" (proof verified off-chain, then registered on-chain). In-browser UltraHonk proving, holder key management, Sybil-blocking nullifiers, on-chain root anchoring, revocation, and a job-gate/reward flow are all implemented. Fully on-chain verification (Path A) and multi-attribute disclosure are in progress — we track these openly as GitHub issues.

**Q3. Why build on Stellar rather than Ethereum or a ZK-native L2?**
Two reasons. First, timing: Stellar's Protocol 25/26 (Jan–May 2026) shipped native BN254 + Poseidon host functions — the exact primitives our Noir stack needs — so on-chain verification is a cheap single host call. Second, distribution: Stellar's anchor network (MoneyGram, USDC, remittance rails) is the ideal channel for reusable KYC, especially in our beachhead market.

**Q4. How does the zero-knowledge proof actually work?**
The issuer commits each credential as a Poseidon Merkle leaf and publishes the root on-chain. In the browser, the holder generates a Noir/UltraHonk proof that (a) their leaf is in the tree, (b) a disclosed attribute matches, (c) a nullifier equals `Poseidon(secret, scope)`, and (d) the proof is bound to their Stellar address — all without revealing the secret or the other attributes.

**Q5. What are the current limitations you'd want us to know?**
Honesty builds trust: today selective disclosure is limited to one attribute (`track`) pending a circuit recompile; reward delivery locks a claimable balance but needs a claim step; and one acceptance test is currently red in CI. All are tracked ([#101](https://github.com/webnxt-2030/zelyo/issues/101), [#103](https://github.com/webnxt-2030/zelyo/issues/103), [#104](https://github.com/webnxt-2030/zelyo/issues/104), [#105](https://github.com/webnxt-2030/zelyo/issues/105)) and none are fundamental — they're the next sprint.

### Privacy, security & trust

**Q6. If nothing personal is on-chain, how do you stop the same person claiming twice (Sybil)?**
The nullifier: a deterministic, unlinkable token `Poseidon(secret, scope)`. The registry stores it on first use and rejects any replay with `NULLIFIER_USED` — enforcing one-use-per-person-per-app without ever learning who the person is.

**Q7. Where is the holder's secret stored, and what happens if they lose it?**
The secret is generated and stored client-side only (WebCrypto, AES-GCM encrypted in IndexedDB) with an exportable backup; the server only ever sees the public commitment `Poseidon(secret)`. Loss means re-issuance — which is why the roadmap includes passkey smart wallets to make key custody seed-free and recoverable.

**Q8. What stops a stolen proof being replayed by someone else?**
Address binding. Each proof is cryptographically bound to a specific Stellar wallet as a public input, so it can't be transferred or replayed from another address.

**Q9. Who do verifiers have to trust?**
Only that a Merkle root was published by a legitimate issuer (verifiable on-chain via the registry) and that the nullifier is unspent (also on-chain). No trust in Zelyo's servers is required for the security properties — that's the point of the on-chain registry.

**Q10. Have you had a security audit?**
Not yet — it's an explicit, budgeted line item in the use-of-funds, and non-negotiable before mainnet for anything touching identity. We also maintain PII-safe audit logging, centralized CSP/COOP/COEP headers, rate limiting, and a Poseidon parity test between the JS and circuit implementations.

### Stellar ecosystem

**Q11. What does Zelyo add to Stellar that isn't there already?**
A privacy-preserving identity/reputation layer — something Stellar currently lacks. It enables bot-proof airdrops, reusable KYC for anchors, and private eligibility checks for DeFi/DAOs, while being a flagship non-payments use of the new BN254/Poseidon host functions.

**Q12. Which existing Stellar protocols and standards will you integrate?**
SEP-10/45 (wallet & smart-wallet auth), SEP-12 (reusable KYC), SEP-8 (regulated-asset gating), SEP-38/7; Soroban BN254/Poseidon/BLS host functions for on-chain verification; the Anchor Platform + USDC/MoneyGram for KYC reuse and reward off-ramp; passkey-kit + Launchtube for seedless, gasless UX; and SDEX path payments + Blend/Soroswap for reward delivery and token gates.

**Q13. Is on-chain ZK verification really feasible on Soroban today?**
Yes — Protocol 25 added native BN254 (the curve Noir proves on) and Poseidon, and Protocol 26 (live May 6, 2026) added more. Two public reference verifiers (Interstellar; an UltraHonk-on-Soroban verifier) demonstrate it. We're validating exact fee/rent economics on testnet before committing hard numbers.

**Q14. How would an anchor actually use this?**
An anchor runs SEP-12 KYC once and issues the user a Zelyo credential. Later, the user proves "I'm KYC-verified / over-18 / resident of X" to another anchor, exchange, or DeFi protocol via a ZK proof + on-chain verified flag — no PII re-sent. It turns the anchors' biggest recurring cost into a shared, reusable asset.

### Business, market & GTM

**Q15. How do you make money?**
Layered: issuer SaaS (institutions pay to mint/manage credentials), reusable-KYC B2B (per-verification fees from anchors/fintechs — the high-margin engine), take-rates on gated reward campaigns, and non-dilutive grants (SCF) to fund the early build.

**Q16. Why start in the Philippines — isn't that limiting?**
It's a wedge, not a ceiling. The PH is one of the world's largest remittance economies with an active Stellar anchor presence (MoneyGram/MGUSD), a huge OFW population that repeatedly submits KYC, a large freelancer workforce proving skills abroad, and supportive eKYC/digital-ID regulation. It's the ideal proving ground for a standard we then expand across APAC and globally.

**Q17. What's the path from Philippines to global?**
PH beachhead (anchors + issuers + freelancers) → APAC expansion along SEA remittance/migrant-worker corridors (PH→SG/JP/AU/ME) via anchor and wallet partnerships → global scale as the reusable-KYC standard, riding the EU eIDAS 2 mandate and authoring the `did:stellar`/VC SEP.

**Q18. How big is the market?**
The narrow view (education credentials) is a wedge; the real TAM is reusable KYC — every anchor, exchange, and fintech re-collects the same identity data today. Regulatory tailwinds (eIDAS 2 mandating selective-disclosure credentials through 2026) expand demand structurally.

**Q19. Who are your first customers and what's the sales motion?**
Two-sided but issuer-led: sign bootcamps/certifiers (issuer SaaS) to seed credentials, then land an anchor pilot for reusable KYC. Near-term goal: 3–5 PH issuers + 1 anchor pilot.

**Q20. What's the regulatory / compliance angle?**
Zelyo is structurally privacy-preserving (no central PII honeypot), which aligns with data-protection regimes and with eIDAS 2's selective-disclosure direction. We'll work within anchor KYC obligations (SEP-12) rather than replace them — we make compliance reusable, not optional. Compliance counsel is in the use-of-funds.

### Competition, team & funding

**Q21. Who are your competitors and why do you win?**
Closest is Luminar (ZK KYC → a single soulbound badge). We differentiate on arbitrary selective disclosure of real credential attributes plus a full issuer→gate→reward lifecycle. Web2 identity vendors (Onfido/Persona/Jumio) are the centralized-honeypot model we replace. No ratified Stellar DID/VC standard exists — first credible mover can define it.

**Q22. What's your moat if this is "just cryptography"?**
Network effects and standards. Once anchors and verifiers share a nullifier/attestation standard through Zelyo, there are switching costs and composability benefits; authoring the DID/VC SEP makes us the reference implementation. The cryptography is table stakes — the shared standard and integrations are the moat.

**Q23. What are you raising, and what will it achieve?**
A blend of SCF 7.0 Build Award (up to $150K XLM, milestone-based) and a seed round, to fund the PH beachhead, the ZK/Soroban engineering team, a security audit, and PH/APAC business development — targeting Path A shipped, reward delivery complete, and the first anchor pilot within ~2 quarters.

**Q24. What are the biggest risks, and how do you mitigate them?**
(1) Technical — on-chain verification economics: mitigated by validating on testnet before promising numbers. (2) Adoption — two-sided marketplace: mitigated by an issuer-led motion and anchor pilots. (3) Regulatory — identity is sensitive: mitigated by a privacy-by-design architecture and compliance counsel. (4) Competition/standards: mitigated by moving first on the DID/VC SEP.

**Q25. Why is now the right time — why hasn't this been built already?**
The enabling primitives only just landed: Stellar shipped native BN254 + Poseidon in Protocol 25 (Jan 2026) and more in Protocol 26 (live May 6, 2026), and passkey smart wallets matured. The regulatory pull (eIDAS 2) and SDF's explicit 2026 privacy strategy arrived at the same moment. The window to define Stellar's identity standard is open right now.

---

*Prepared as the companion guide to `pitch-deck-v3.pptx`. Not financial or legal advice; verify the items flagged medium-confidence in issue #108 before external use.*
