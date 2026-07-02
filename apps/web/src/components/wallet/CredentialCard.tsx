import Link from "next/link";

export interface CredentialCardModel {
  id: string;
  status: "ACTIVE" | "REVOKED";
  issuerName: string;
  attributes: { courseName: string; track: string; issueDate: string; grade: string; learnerName: string };
  leafIndex: number;
}

export function CredentialCard({
  credential,
  signatureHash,
  orphaned = false,
  gate,
  proof,
  claimHref,
}: {
  credential: CredentialCardModel;
  signatureHash: string;
  orphaned?: boolean;
  gate?: string | undefined;
  proof?: { txHash: string | null; disclosed: string[]; provenAt: Date } | undefined;
  claimHref?: string | undefined;
}) {
  // When arriving from a gate, carry its slug so proving loops back to the gate to claim.
  const proveHref = gate
    ? `/wallet/prove/${credential.id}?gate=${encodeURIComponent(gate)}`
    : `/wallet/prove/${credential.id}`;
  // Only non-PII fields are rendered: course, track, issuer, date, status, signature hash.
  return (
    <article className="foil-stamp relative rounded-lg p-stack-lg text-primary-fixed">
      {/* State seal — pinned so it never pushes the body down; keeps every card's
          title on the same line across the grid. */}
      {orphaned ? (
        <span
          role="alert"
          className="absolute right-stack-lg top-stack-lg z-10 rounded-full border border-error/60 bg-error/25 px-stack-sm py-0.5 font-label text-caption uppercase tracking-wider text-error-container"
        >
          Not provable
        </span>
      ) : proof ? (
        <span className="absolute right-stack-lg top-stack-lg z-10 rounded-full border border-primary-fixed-dim/40 bg-white/10 px-stack-sm py-0.5 font-label text-caption uppercase tracking-wider text-primary-fixed">
          Proven ✓
        </span>
      ) : null}
      <p className="pr-24 font-label text-caption uppercase tracking-wider text-primary-fixed-dim">
        Identity Folio No. {credential.leafIndex}
      </p>
      <h3 className="mt-unit font-headline text-headline-md text-on-primary">
        {credential.attributes.courseName}
      </h3>
      <dl className="mt-stack-md space-y-unit font-body text-body-md text-primary-fixed">
        <div className="flex justify-between">
          <dt className="font-label text-label-md uppercase text-primary-fixed-dim">Track</dt>
          <dd>{credential.attributes.track}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-label text-label-md uppercase text-primary-fixed-dim">Issuer</dt>
          <dd>{credential.issuerName}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-label text-label-md uppercase text-primary-fixed-dim">Issued</dt>
          <dd>{credential.attributes.issueDate}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-label text-label-md uppercase text-primary-fixed-dim">Signature</dt>
          <dd className="typewriter">{signatureHash.slice(0, 10)}…</dd>
        </div>
      </dl>
      <p className="mt-stack-md font-label text-label-md uppercase text-primary-fixed-dim">
        Status: {credential.status}
      </p>
      {proof && !orphaned && (
        <p className="mt-unit font-body text-caption text-primary-fixed-dim">
          Sealed {proof.provenAt.toLocaleDateString()}
          {proof.disclosed.length > 0 ? ` · revealed ${proof.disclosed.join(", ")}` : ""}
        </p>
      )}
      {orphaned && (
        <p className="mt-unit font-body text-caption text-error-container/80">
          Issued to a previous identity — restore it to prove again.
        </p>
      )}
      <div className="relative z-10 mt-stack-lg flex items-center justify-between gap-gutter">
        <div className="flex items-center gap-stack-md">
          <Link className="font-label text-label-md uppercase text-primary-fixed-dim hover:text-on-primary underline transition-colors" href={`/wallet/credentials/${credential.id}`}>
            Details
          </Link>
          {proof?.txHash && (
            <Link className="font-label text-label-md uppercase text-primary-fixed-dim hover:text-on-primary underline transition-colors" href={`/verify/result/${proof.txHash}`}>
              View proof
            </Link>
          )}
          {claimHref && !orphaned && (
            <Link className="font-label text-label-md uppercase text-primary-fixed-dim hover:text-on-primary underline transition-colors" href={proveHref}>
              Re-prove
            </Link>
          )}
        </div>
        {orphaned ? (
          <span
            aria-disabled="true"
            title="This credential was issued to a previous identity. Restore that identity to prove it."
            className="inline-flex items-center rounded px-stack-md py-3 font-label text-label-md uppercase bg-white/10 text-primary-fixed-dim line-through cursor-not-allowed opacity-60"
          >
            Prove
          </span>
        ) : claimHref ? (
          <Link
            className="inline-flex items-center rounded bg-primary-fixed px-stack-md py-3 font-label text-label-md uppercase text-primary hover:-translate-y-px transition-transform"
            href={claimHref}
          >
            Use this proof to claim
          </Link>
        ) : (
          <Link
            className="inline-flex items-center rounded bg-primary-fixed px-stack-md py-3 font-label text-label-md uppercase text-primary hover:-translate-y-px transition-transform"
            href={proveHref}
          >
            {proof ? "Re-prove" : "Prove"}
          </Link>
        )}
      </div>
    </article>
  );
}
