import Link from "next/link";
import { RevealNarrative } from "../components/RevealNarrative";

export default function HomePage() {
  return (
    <main className="py-stack-lg">
      <p className="font-label text-label-md uppercase text-secondary">The Zelyo Protocol</p>
      <h1 className="font-display text-display-lg text-on-background mt-stack-sm max-w-3xl">
        Verifiable credentials, sealed with the gravity of a printed record.
      </h1>
      <p className="font-body text-body-lg text-on-surface-variant mt-stack-md max-w-2xl">
        Prove one fact about a credential in zero knowledge. The chain records only a nullifier —
        never who you are.
      </p>

      <div className="mt-stack-lg">
        <Link
          href="/jobs"
          className="foil-stamp inline-flex items-center rounded px-stack-md py-3 font-label text-label-md uppercase text-on-primary hover:-translate-y-px transition-transform"
        >
          See the Reveals
        </Link>
      </div>

      <div className="mt-stack-lg">
        <RevealNarrative />
      </div>
    </main>
  );
}
