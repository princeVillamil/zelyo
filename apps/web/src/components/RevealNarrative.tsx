import Link from "next/link";

const REVEALS = [
  {
    eyebrow: "Reveal I",
    title: "Nothing personal on-chain",
    body: "A verification writes only a zero-knowledge proof and a nullifier hash to the ledger. No name, no grade, no email ever touches the chain — inspect any transaction on the public explorer and see for yourself.",
  },
  {
    eyebrow: "Reveal II",
    title: "One credential, one registration",
    body: "The same credential can prove a fact only once per scope. A second proof reuses the nullifier and the registry contract rejects it on-chain. That rejection is the Sybil block — enforced by mathematics, not by trust.",
  },
  {
    eyebrow: "Reveal III",
    title: "Selective disclosure unlocks a claim",
    body: "Disclose a single fact — your track — while name and grade stay sealed. A valid proof against a public gate unlocks a Stellar-native reward bound to your wallet.",
  },
];

export function RevealNarrative() {
  return (
    <div>
      <div className="grid gap-stack-lg">
        {REVEALS.map((r) => (
          <section key={r.eyebrow} className="ledger-line border-l border-l-primary pl-stack-md py-stack-sm">
            <p className="font-label text-label-md uppercase text-secondary">{r.eyebrow}</p>
            <h2 className="font-headline text-headline-md text-on-background mt-stack-sm">{r.title}</h2>
            <p className="font-body text-body-md text-on-surface-variant mt-stack-sm max-w-2xl">{r.body}</p>
          </section>
        ))}
      </div>

      <div className="mt-stack-lg flex flex-wrap gap-stack-md">
        <Link href="/issuer" className="font-label text-label-md uppercase text-primary border-b border-primary pb-1">
          Issue a Credential
        </Link>
        <Link href="/wallet" className="font-label text-label-md uppercase text-primary border-b border-primary pb-1">
          Open Your Wallet
        </Link>
        <Link href="/jobs" className="font-label text-label-md uppercase text-primary border-b border-primary pb-1">
          Browse the Gates
        </Link>
      </div>
    </div>
  );
}
