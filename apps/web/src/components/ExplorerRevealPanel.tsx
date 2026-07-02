import Link from "next/link";
import type { VerificationView } from "../server/verification-read.service";

const PERSONAL_FIELDS = ["learner name", "name", "grade", "email", "course"];

export function ExplorerRevealPanel({ view }: { view: VerificationView }) {
  if (view.result === "NULLIFIER_USED") {
    return (
      <section className="border border-error-container bg-error-container/40 rounded-lg p-stack-lg">
        <p className="font-label text-label-md uppercase text-error">Sybil Block</p>
        <h2 className="font-display text-headline-md text-on-background mt-stack-sm">
          This credential has already been used
        </h2>
        <p className="font-body text-body-md text-on-surface-variant mt-stack-md">
          The nullifier for this proof was already recorded on-chain. A second proof from the
          same credential is rejected by the registry contract — this rejection{" "}
          <em>is</em> the Sybil block. One credential, one registration.
        </p>
        <dl className="mt-stack-md font-mono text-caption text-on-surface-variant">
          <dt className="font-label uppercase">Nullifier</dt>
          <dd>{view.nullifierHex}</dd>
        </dl>
      </section>
    );
  }

  return (
    <section className="border border-outline-variant bg-surface-container-lowest rounded-lg p-stack-lg manuscript-glow">
      <p className="font-label text-label-md uppercase text-primary">Verified · On-Chain</p>
      <h2 className="font-display text-headline-md text-on-background mt-stack-sm">
        Nothing personal is recorded on-chain
      </h2>
      <p className="font-body text-body-md text-on-surface-variant mt-stack-md">
        This transaction&rsquo;s payload contains only a zero-knowledge proof and a nullifier
        hash. No name, no grade, no email — none of the credential&rsquo;s attributes appear on
        the ledger. Inspect it yourself on the public explorer.
      </p>

      <dl className="mt-stack-md grid gap-stack-sm font-mono text-caption text-on-surface-variant">
        <div>
          <dt className="font-label uppercase text-secondary">Nullifier Hash</dt>
          <dd className="break-all">{view.nullifierHex}</dd>
        </div>
        <div>
          <dt className="font-label uppercase text-secondary">Bound Address</dt>
          <dd className="break-all">{view.boundAddress}</dd>
        </div>
        <div>
          <dt className="font-label uppercase text-secondary">Transaction</dt>
          <dd className="break-all">{view.txHash}</dd>
        </div>
      </dl>

      <div className="mt-stack-lg flex flex-wrap items-center gap-stack-md">
        <a
          href={view.explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="foil-stamp inline-flex items-center rounded px-stack-md py-3 font-label text-label-md uppercase text-on-primary hover:-translate-y-px transition-transform"
        >
          View on the Stellar Explorer
        </a>
        <Link
          href="/jobs"
          className="inline-flex items-center rounded border border-outline-variant px-stack-md py-3 font-label text-label-md uppercase text-on-background hover:border-outline hover:-translate-y-px transition-transform"
        >
          Browse Reward Gates
        </Link>
      </div>

      <p className="sr-only">
        On-chain payload excludes: {PERSONAL_FIELDS.join(", ")}.
      </p>
    </section>
  );
}
