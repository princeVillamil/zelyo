import Link from "next/link";
import type { GateSummary } from "../server/jobgate.service";

export function GateCard({ gate }: { gate: GateSummary }) {
  // A public listing, not a sealed folio: flat/light surface, hairline outline, and a
  // status pill in the header. The deep-green foil-stamp fill is reserved for the wallet.
  const expired = gate.expiresAt ? new Date() > new Date(gate.expiresAt) : false;
  return (
    <Link
      href={`/jobs/${gate.slug}`}
      className="group block rounded-lg border border-outline-variant border-l-2 border-l-primary bg-surface-container-lowest p-stack-md transition-transform transition-colors hover:-translate-y-px hover:border-outline"
    >
      {/* Posting header: section eyebrow + open/expired status, at a glance. */}
      <div className="flex items-center justify-between gap-gutter">
        <p className="font-label text-label-md uppercase text-secondary">Registry Gate</p>
        <span
          className={`rounded-full px-stack-sm py-0.5 font-label text-caption uppercase tracking-wider ${
            expired
              ? "border border-outline-variant text-on-surface-variant"
              : "border border-primary/40 text-primary"
          }`}
        >
          {expired ? "Expired" : "Open"}
        </span>
      </div>
      <h3 className="font-headline text-headline-md text-on-background mt-stack-sm">{gate.title}</h3>
      <p className="font-body text-body-md text-on-surface-variant mt-stack-sm">{gate.description}</p>
      {/* The single fact this gate opens to — framed as a spec, not a personal seal. */}
      <div className="mt-stack-md space-y-1 border-l-2 border-primary bg-surface-container px-stack-md py-stack-sm rounded-r">
        {gate.requiredPredicates.map((pred, i) => (
          <p key={i} className="font-mono text-caption text-on-surface-variant">
            {pred.attribute} == &ldquo;{pred.equals}&rdquo;{i < gate.requiredPredicates.length - 1 ? " AND" : ""}
          </p>
        ))}
      </div>
      {gate.expiresAt && (
        <p className="font-mono text-caption text-on-surface-variant mt-stack-sm">
          Expires: {new Date(gate.expiresAt).toLocaleDateString()}
        </p>
      )}
    </Link>
  );
}
