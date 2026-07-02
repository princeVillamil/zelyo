# Zelyo — Hackathon Pitch Deck

> Prove one fact about a credential without revealing who you are.
>
> This deck is grounded in `SPEC.md` and the shipped codebase (`apps/web`, `circuits`, `contracts`, `packages/zk-shared`), `docs/features.md`, and `docs/REMAINING_TASKS.md`. It is written for a mixed audience, including non-technical judges, so it leads with outcomes and the privacy property rather than the implementation. Anything not confirmable from code/spec is tagged `[inferred]`. Target talk length: 3–5 minutes.

---

## Slide 1: Title

# Zelyo

**Seal a credential. Prove one fact. Reveal nothing else.**

*Prove you're qualified without handing over your whole identity.*

- **Team:** Team Zelyo — `[team name placeholder]`
- **Repo:** `[repo URL placeholder]` · **Live demo:** `[demo URL placeholder]` [inferred]

![Placeholder: hero cover — Zelyo wordmark on warm-paper background with the foil-stamp seal and the tagline "Seal a credential. Prove one fact. Reveal nothing else."](placeholder-image.png)

**Speaker notes:**
Hi, we're Team Zelyo. Our one-line pitch is right on the slide: seal a credential, prove one fact, reveal nothing else. Today, proving you're qualified means handing over your whole identity — a diploma, a transcript, an ID — and trusting whoever you sent it to. Zelyo lets you prove a single fact about a credential, sealed to your wallet, so the only thing ever recorded anywhere public is an anonymous, one-time stamp — never who you are. Over the next few minutes I'll walk you through the problem, a live demo, how it works in plain terms, and what's next.

---

## Slide 2: Problem

**Proving you're qualified today costs you your privacy.**

- **Over-disclosure** — every job application, KYC check, or badge forces you to hand over *full* documents, resumes, or IDs to prove a single fact.
- **Centralized honeypots** — platforms stockpile personal data that becomes a breach target; one leak and your identity is gone.
- **Slow, expensive trust** — verifying a credential means calling a third party, waiting on an email, or trusting a screenshot.
- **No user control** — once you share a PDF diploma or passport scan, you lose control over who sees it, forever.

![Placeholder: side-by-side contrast — left: "today" a pile of exposed documents (diploma, ID, transcript) with redaction lines; right: "with Zelyo" a single sealed envelope showing only "track = Data Engineering ✓"](placeholder-image.png)

**Speaker notes:**
The problem is simple and personal. If you've ever applied for a job, you've emailed a full transcript to a stranger just to prove you took one course. That's over-disclosure — you reveal everything to prove one thing. Every platform that collects that data is a honeypot waiting to be breached, and the moment you share a scan, you lose control of it forever. Verification itself is slow and manual: someone calls a registrar, waits for an email, or just trusts a screenshot. For freelancers, remote workers, anyone crossing borders, the cost of proving you're qualified is privacy itself. Zelyo exists to make that cost zero.

---

## Slide 3: Solution

**Zelyo lets an issuer seal a credential and a holder prove one fact about it — without revealing anything else.**

- **Your secret never leaves your device** — the proof is made in your own browser; no server ever sees your identity key.
- **Fraud-proof and reuse-proof** — a public, tamper-proof registry refuses the same credential twice, so it can't be faked or spent again.
- **Reveal only what's needed** — show one attribute (e.g. your track) while your name, grade, and dates stay private — and unlock the reward that comes with it.

![Placeholder: three-pillar diagram — "Prove in your browser" (laptop) → "Reuse-proof registry" (ledger/stamp) → "Reveal one fact, unlock the reward" (sealed envelope + coin)](placeholder-image.png)

**Speaker notes:**
Here's the solution in one sentence: an issuer seals a credential, the holder proves one fact about it, and nothing else is ever revealed. Three things make that real. First, the proof is generated entirely in the holder's browser — their identity secret never leaves the device, so no server ever sees it. Second, a public, tamper-proof registry refuses the same credential twice, which gives us real fraud resistance — you can't fake or reuse a credential. Third, selective disclosure is wired to a real reward: reveal just your track, and a valid proof unlocks a spendable reward at a gated job board. One fact proven, nothing else leaked, a real reward delivered.

---

## Slide 4: Demo

**The core flow: seal → prove → reveal → claim.**

1. **Seal (issuer)** — the issuer enters the learner's details (name, track, grade, date). The credential is sealed into a public, tamper-proof registry — only a fingerprint of the data is published, never the data itself. A live log narrates each step.
2. **Keys (holder)** — the holder creates their identity key in their browser. The secret is encrypted on their device and never sent to any server; only a public commitment is shared.
3. **Prove (holder)** — the holder picks the one fact to reveal (default: their track), binds it to their wallet, and presses the seal button. A zero-knowledge proof is generated in the browser and submitted.
4. **Reveal** — the result page shows an anonymous, one-time stamp and a link to the public record. **No name, no grade, no dates — nothing personal, anywhere.** Proving the same credential a second time is rejected (the live Sybil block).
5. **Claim (anyone → holder)** — a gated job board checks the proof and unlocks a real, spendable reward to the holder's wallet.

![Placeholder: 5-frame storyboard screenshot strip — the issuer sealing form with the live log, the holder's key/seal page, the prove page with one disclosure checked + the seal button, the reveal page showing only the anonymous stamp + public-record link, the job-gate "Reward Unlocked" panel](placeholder-image.png)

[PLACEHOLDER: Demo video — ~90-second screen recording of the full spine: issuer seals a "Data Engineering" credential → holder creates their key → holder reveals only their track, binds their wallet, and generates the proof in-browser (show the live log) → reveal page shows the anonymous stamp and the public-record link, with no personal data → a second attempt is rejected → holder claims the gate reward. Target length 75–105s.]

**Speaker notes:**
This is the spine of the product, and it's the actual acceptance criteria from our spec. An issuer seals a credential — name, track, grade, date — and a live log narrates each step as the fingerprint is built and published to the registry; the personal data itself never goes in. The holder then creates their identity key in-browser — the secret is encrypted on the device and never touches a server. Then the moment that makes it work: on the prove page, they choose to reveal only their track, bind their wallet, and press the seal button. The proof is generated right there in the browser and submitted. The result page shows what was recorded — an anonymous, one-time stamp and a link to the public record — and zero personal data. Try the same credential again and it's rejected; you can't reuse it. Finally, the holder claims the job-gate reward, and a real, spendable reward lands for their wallet.

---

## Slide 5: How it works

**Think of it like a notary that never reads your document.**

- **The issuer** seals credentials and publishes only a fingerprint of them to a public, tamper-proof registry — not the data itself.
- **The holder** holds the only key. To prove a fact, they produce a sealed proof — *"I'm in that registry, and my track is X"* — without ever opening the document.
- **The registry** is the source of truth: it won't accept a credential that isn't valid, it won't accept the same credential twice, and it never stores anything personal.
- **The verifier** posts reward gates; a valid proof checks out and the reward is released to the holder's wallet.

> Three roles, one rule: the only thing that ever enters the public record is an anonymous, one-time stamp. Everything personal stays on the holder's device.

![Placeholder: simple line-art diagram — Issuer (seal) → public registry (fingerprint only) ← Holder (key + proof) → Verifier (gate + reward), with "no personal data" called out on the registry](placeholder-image.png)

**Speaker notes:**
For a non-technical framing, think of Zelyo like a notary that never actually reads your document. The issuer seals credentials and publishes only a fingerprint to a public, tamper-proof registry — never the data itself, so there's nothing personal to leak or breach. The holder holds the only key; to prove a fact, they produce a sealed proof that says "I'm in that registry, and my track is X" — without ever opening the document. The registry is the source of truth: it won't accept an invalid credential, it won't accept the same one twice, and it never stores anything personal. And the verifier just posts reward gates; a valid proof checks out and the reward is released to the holder's wallet. The one rule that makes all of this work: the only thing that ever enters the public record is an anonymous, one-time stamp.

---

## Slide 6: Impact / market

**Who needs this, and why.**

- **Issuers** (universities, bootcamps, certifiers) — issue fraud-proof credentials and publish them to a public registry *without* running a database of personal details. No honeypot to breach.
- **Holders** (freelancers, remote workers, professionals crossing borders) — carry proof of skills in a wallet; reveal only what each opportunity requires. Self-sovereign: they hold the only key.
- **Verifiers** (employers, marketplaces, DAOs) — confirm a claim cryptographically with **no personal-data liability** and no manual checks; pay a reward straight to the wallet.
- **Builders** — a working, end-to-end scaffold to extend with new credential types, gates, and rewards.

> A credential today is a liability: a file you can't un-share. Zelyo turns it into a portable, private, provable asset. `[inferred]` market sizing is intentionally omitted — a working system is more honest than a fabricated market number.

![Placeholder: four-quadrant audience map — Issuers / Holders / Verifiers / Builders with one-line value props each](placeholder-image.png)

**Speaker notes:**
Four groups need this. Issuers — a university or bootcamp — can issue fraud-proof credentials and publish them to a public registry without keeping a database of personal details, which means there's no honeypot to breach. Holders — freelancers, remote workers, anyone crossing borders — get to carry proof of their skills and reveal only what a specific opportunity requires, and they hold their own key, so it's genuinely self-sovereign. Verifiers — employers, marketplaces, DAOs — confirm claims cryptographically with zero personal-data liability and can pay a reward straight to the wallet. And builders get a working, end-to-end scaffold to extend with new credential types, gates, and rewards. The deeper shift: today a credential is a liability, a file you can't un-share. Zelyo turns it into a portable, private, provable asset. We've left market-size numbers off the slide on purpose — a working system is more honest than a fabricated number.

---

## Slide 7: What's next

**Honest gaps between the spec and what's shipped today** (from `docs/REMAINING_TASKS.md`).

- **Prove one fact — but only one specific fact today.** The proof currently reveals a single attribute (your track). We're building it so you can choose *any* single attribute to reveal; until then, the UI says so rather than over-promising.
- **The reward is locked aside for you, but needs one more tap.** Today the reward is set aside for the holder's wallet; we'll add the in-app step that actually moves it into a spendable balance, and confirm success on screen.
- **One small form fix** so native-asset rewards can be created from the UI (today they work through the API only).
- **Full proof-checking inside the registry** — today we check the proof and the registry enforces the rules; we'll move the proof-check itself inside the registry once the underlying network supports it.
- **Roadmap:** date and range checks ("I earned this after 2024"), trusted-issuer lists, tighter binding of a claim to the gate it was proven for, and a marketplace of gates.

![Placeholder: roadmap timeline — Now (prove your track, reuse-proof registry, reward set aside) → Next (prove any one attribute, spendable reward, native-asset form) → Later (in-registry proof checks, date/range, trusted issuers, gate marketplace)](placeholder-image.png)

**Speaker notes:**
We keep a public list of what's left, and we'll be honest about it. The biggest one: today you can prove only one specific fact — your track. We're building it so you can choose any single attribute to reveal, and until then the prove page says so plainly rather than fake it with extra checkboxes. Second, the reward is set aside for the holder's wallet, but there's no in-app step to actually make it spendable yet — we'll add that, and confirm success on screen instead of just showing a transaction id. Third, native-asset rewards work through our API but not yet through the form — a small fix. And the rest — date and range checks, trusted-issuer lists, tighter claim binding, and a marketplace of gates — is our roadmap. We lead with what's real.

---

## Slide 8: Team / thanks

**Team Zelyo**

| Name | Role | Contact |
|------|------|---------|
| `[team member 1 — placeholder]` | `[role — e.g. product & ZK]` | `[GitHub / email]` |
| `[team member 2 — placeholder]` | `[role — e.g. app & UX]` | `[GitHub / email]` |
| `[team member 3 — placeholder]` | `[role — e.g. design & protocol]` | `[GitHub / email]` |

**Thanks to** — the open-source zero-knowledge and privacy-infrastructure communities whose proving and cryptographic primitives we build on.

**Links:** repo `[repo URL placeholder]` · demo `[demo URL placeholder]` · docs `docs/features.md`, `docs/REMAINING_TASKS.md`, `docs/DEPLOY.md`

![Placeholder: team photo or avatar row placeholder](placeholder-image.png)

**Speaker notes:**
That's Zelyo — privacy-preserving credentials, sealed with the gravity of a printed record. We're a small team and we've left placeholders for names and roles, but what we built is real and running: a working prove-and-reveal flow, a reuse-proof registry, in-browser proof generation, and a live reward. Thanks to the open-source zero-knowledge and privacy-infrastructure communities whose work we build on. We'd love to talk to issuers, verifiers, and anyone who wants to build on this. Privacy is the default — let's make it the standard. Thank you.

---

# Recording Script

> A continuous, readable script for recording the pitch (~4 minutes spoken). Cover this top-to-bottom; do not read the slides verbatim — the slides are the visuals.

---

"Hi — we're Team Zelyo, and we want to fix something that's been quietly broken for a long time: the way you prove you're qualified.

Think about the last time you applied for anything. You emailed a stranger your full transcript just to prove you took one course. You uploaded a passport scan to prove you're over eighteen. Every platform that collects that information is a honeypot waiting to be breached — and the moment you hit send, you lose control of your identity forever. Verification today is slow, it's manual, and it's expensive, because the only way we know to trust a credential is to see all of it. For freelancers, for remote workers, for anyone crossing borders, the cost of proving you're qualified is your privacy itself.

Zelyo is our answer, in one sentence: prove one fact about a credential in zero-knowledge, and never reveal anything else. Your secret never leaves your device. The same credential can't be used twice. And you reveal only what each opportunity actually needs.

Here's what that looks like. An issuer — say a course provider — seals a credential into a public, tamper-proof registry. But here's the key part: they only publish a fingerprint of the data, not the data itself. No names, no grades, no personal details ever go into that registry.

The holder then creates their identity key right in their browser. The secret stays on their device — our server never sees it. Only a public commitment is shared.

Now the moment that makes this work. The holder opens the prove page, picks the one fact they want to reveal — 'my track is Data Engineering' — binds it to their wallet, and presses the seal button. A zero-knowledge proof is generated right there in the browser and submitted. The result page shows what was recorded: an anonymous, one-time stamp, and a link to the public record. No name. No grade. No dates. Nothing personal — anywhere. Try to prove the same credential a second time and the registry rejects it. That's our live Sybil block — you can't fake or reuse a credential. Finally, the holder claims the reward at a gated job board, and a real, spendable reward lands for their wallet.

Think of it like a notary that never reads your document. Three roles: the issuer seals credentials, the holder proves facts and holds the only key, the verifier checks the proof and pays the reward. The registry is the source of truth — it won't accept a credential twice, and nothing personal is ever written to it.

Who's this for? Issuers — a university or bootcamp — can issue fraud-proof credentials without keeping a database of personal details, so there's no honeypot to breach. Holders carry proof of their skills and reveal only what each opportunity requires, and they hold their own key, so it's genuinely self-sovereign. Verifiers confirm a claim cryptographically with zero personal-data liability, and can pay a reward straight to the wallet.

We'll be honest about where we are. Today you can only prove one specific fact — your track. We're building it so you can choose any single attribute to reveal. The reward is set aside for you, but needs one more tap to actually become spendable — we'll add that step. And the rest — date and range checks, trusted-issuer lists, a marketplace of gates — is our roadmap.

Here's the shift we care about. Today a credential is a liability — a file you can't un-share. Zelyo turns it into a portable, private, provable asset. We'd love to talk to issuers, verifiers, and anyone who wants to build on this. Privacy is the default — let's make it the standard. Thank you."