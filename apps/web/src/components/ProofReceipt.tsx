import Link from "next/link";
import type { VerificationView } from "../server/verification-read.service";
import { explorerTxUrl } from "../lib/explorer";
import { ALL_ATTRIBUTE_LABELS } from "../lib/attribute-labels";

/**
 * Post-verification receipt: the fact that was proven, what was never revealed,
 * and the on-chain anchors (nullifier, Merkle root, verification tx). Renders
 * attribute LABELS only for hidden fields — values never reach this page.
 */
export function ProofReceipt({ view }: { view: VerificationView }) {
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

  const disclosedEntries = Object.entries(view.disclosedRaw);
  const hiddenLabels = (Object.keys(ALL_ATTRIBUTE_LABELS) as (keyof typeof ALL_ATTRIBUTE_LABELS)[])
    .filter((key) => !(key in view.disclosedRaw))
    .map((key) => ALL_ATTRIBUTE_LABELS[key]);

  return (
    <section className="border border-outline-variant bg-surface-container-lowest rounded-lg p-stack-lg manuscript-glow">
      <p className="font-label text-label-md uppercase text-primary">Verified · On-Chain</p>
      <h2 className="font-display text-headline-md text-on-background mt-stack-sm">
        {view.jobGateTitle ? (
          <>Proved eligibility for &ldquo;{view.jobGateTitle}&rdquo;</>
        ) : (
          "Credential proven — nothing personal revealed"
        )}
      </h2>

      {/* The fact: disclosed predicate(s) only. */}
      <div className="mt-stack-md border-l-2 border-primary bg-surface-container px-stack-md py-stack-sm rounded-r">
        <p className="font-label text-caption uppercase text-secondary mb-stack-sm">Fact proven</p>
        {disclosedEntries.length > 0 ? (
          disclosedEntries.map(([key, val]) => (
            <p key={key} className="font-mono text-caption text-on-surface-variant">
              {key} == &ldquo;{val}&rdquo;
            </p>
          ))
        ) : (
          <p className="font-mono text-caption text-on-surface-variant">
            membership in the issuer&rsquo;s credential registry
          </p>
        )}
        <p className="font-body text-caption text-on-surface-variant mt-stack-sm">
          Verified against the issuer&rsquo;s Merkle root — the credential itself was never
          opened.
        </p>
      </div>

      {/* Never revealed: labels only, never values. */}
      {hiddenLabels.length > 0 && (
        <div className="mt-stack-md">
          <p className="font-label text-caption uppercase text-secondary mb-stack-sm">
            Never revealed
          </p>
          <ul className="flex flex-wrap gap-stack-sm">
            {hiddenLabels.map((label) => (
              <li
                key={label}
                className="rounded-full border border-outline-variant px-stack-sm py-1 font-label text-caption uppercase text-on-surface-variant"
              >
                {label} · [Never Revealed]
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* On-chain anchors. */}
      <dl className="mt-stack-lg grid gap-stack-sm font-mono text-caption text-on-surface-variant">
        <div>
          <dt className="font-label uppercase text-secondary">Nullifier Hash</dt>
          <dd className="break-all">{view.nullifierHex}</dd>
        </div>
        {view.rootHex && (
          <div>
            <dt className="font-label uppercase text-secondary">Merkle Root</dt>
            <dd className="break-all">{view.rootHex}</dd>
            {view.rootAnchorTxHash && (
              <dd className="mt-1">
                <a
                  href={explorerTxUrl(view.rootAnchorTxHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-label uppercase text-primary underline"
                >
                  Root anchored on-chain
                </a>
              </dd>
            )}
          </div>
        )}
        <div>
          <dt className="font-label uppercase text-secondary">Bound Address</dt>
          <dd className="break-all">{view.boundAddress}</dd>
        </div>
        <div>
          <dt className="font-label uppercase text-secondary">Verification Transaction</dt>
          <dd className="break-all">{view.txHash}</dd>
        </div>
        <div>
          <dt className="font-label uppercase text-secondary">Sealed</dt>
          <dd>{view.createdAt.toLocaleString()}</dd>
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
          href={view.jobGateSlug ? `/jobs/${view.jobGateSlug}` : "/jobs"}
          className="inline-flex items-center rounded border border-outline-variant px-stack-md py-3 font-label text-label-md uppercase text-on-background hover:border-outline hover:-translate-y-px transition-transform"
        >
          {view.jobGateSlug ? "Go to the Gate" : "Browse Reward Gates"}
        </Link>
      </div>
    </section>
  );
}
