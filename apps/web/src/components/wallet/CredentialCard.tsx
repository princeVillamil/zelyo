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
    <article className="manuscript-glow relative border-l border-primary border border-outline-variant rounded-lg bg-surface-container-lowest p-stack-lg">
      {orphaned && (
        <p
          role="alert"
          className="mb-stack-md border border-error rounded bg-error-container/40 px-stack-sm py-unit font-label text-label-md uppercase text-error"
        >
          Previous identity — not provable
        </p>
      )}
      {proof && !orphaned && (
        <p className="mb-stack-md border border-primary rounded bg-primary/10 px-stack-sm py-unit font-label text-label-md uppercase text-primary">
          Proven ✓ · sealed {proof.provenAt.toLocaleDateString()}
          {proof.disclosed.length > 0 ? ` · revealed ${proof.disclosed.join(", ")}` : ""}
        </p>
      )}
      <p className="font-label text-caption uppercase tracking-wider text-secondary">
        Identity Folio No. {credential.leafIndex}
      </p>
      <h3 className="mt-unit font-headline text-headline-md text-primary">
        {credential.attributes.courseName}
      </h3>
      <dl className="mt-stack-md space-y-unit font-body text-body-md text-on-surface-variant">
        <div className="flex justify-between">
          <dt className="font-label text-label-md uppercase text-secondary">Track</dt>
          <dd>{credential.attributes.track}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-label text-label-md uppercase text-secondary">Issuer</dt>
          <dd>{credential.issuerName}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-label text-label-md uppercase text-secondary">Issued</dt>
          <dd>{credential.attributes.issueDate}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-label text-label-md uppercase text-secondary">Signature</dt>
          <dd className="typewriter">{signatureHash.slice(0, 10)}…</dd>
        </div>
      </dl>
      <p className="mt-stack-md font-label text-label-md uppercase text-primary">
        Status: {credential.status}
      </p>
      <div className="mt-stack-lg flex items-center justify-between gap-gutter">
        <div className="flex items-center gap-stack-md">
          <Link className="font-label text-label-md uppercase text-secondary hover:text-primary underline transition-colors" href={`/wallet/credentials/${credential.id}`}>
            Details
          </Link>
          {proof?.txHash && (
            <Link className="font-label text-label-md uppercase text-secondary hover:text-primary underline transition-colors" href={`/verify/result/${proof.txHash}`}>
              View proof
            </Link>
          )}
          {claimHref && !orphaned && (
            <Link className="font-label text-label-md uppercase text-secondary hover:text-primary underline transition-colors" href={proveHref}>
              Re-prove
            </Link>
          )}
        </div>
        {orphaned ? (
          <span
            aria-disabled="true"
            title="This credential was issued to a previous identity. Restore that identity to prove it."
            className="inline-flex items-center rounded px-stack-md py-3 font-label text-label-md uppercase bg-surface-container text-on-surface-variant line-through cursor-not-allowed opacity-60"
          >
            Prove
          </span>
        ) : claimHref ? (
          <Link
            className="foil-stamp inline-flex items-center rounded px-stack-md py-3 font-label text-label-md uppercase text-on-primary hover:-translate-y-px transition-transform"
            href={claimHref}
          >
            Use this proof to claim
          </Link>
        ) : (
          <Link
            className="foil-stamp inline-flex items-center rounded px-stack-md py-3 font-label text-label-md uppercase text-on-primary hover:-translate-y-px transition-transform"
            href={proveHref}
          >
            {proof ? "Re-prove" : "Prove"}
          </Link>
        )}
      </div>
    </article>
  );
}
