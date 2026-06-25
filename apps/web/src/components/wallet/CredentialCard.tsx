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
}: {
  credential: CredentialCardModel;
  signatureHash: string;
}) {
  // Only non-PII fields are rendered: course, track, issuer, date, status, signature hash.
  return (
    <article className="manuscript-glow relative border-l border-primary border border-outline-variant rounded-lg bg-surface-container-lowest p-stack-lg">
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
      <div className="mt-stack-lg flex gap-gutter">
        <Link className="font-label text-label-md uppercase text-primary underline" href={`/wallet/credentials/${credential.id}`}>
          View
        </Link>
        <Link className="font-label text-label-md uppercase text-primary underline" href={`/wallet/prove/${credential.id}`}>
          Prove
        </Link>
      </div>
    </article>
  );
}
