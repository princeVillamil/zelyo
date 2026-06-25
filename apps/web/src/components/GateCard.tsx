import Link from "next/link";
import type { GateSummary } from "../server/jobgate.service";

export function GateCard({ gate }: { gate: GateSummary }) {
  return (
    <Link
      href={`/jobs/${gate.slug}`}
      className="block border-l border-l-primary border border-outline-variant bg-surface-container-lowest rounded-lg p-stack-md hover:opacity-90 transition-opacity"
    >
      <p className="font-label text-label-md uppercase text-secondary">Registry Gate</p>
      <h3 className="font-headline text-headline-md text-on-background mt-stack-sm">{gate.title}</h3>
      <p className="font-body text-body-md text-on-surface-variant mt-stack-sm">{gate.description}</p>
      <p className="font-mono text-caption text-on-surface-variant mt-stack-md">
        Requires: {gate.requiredPredicate.attribute} == &ldquo;{gate.requiredPredicate.equals}&rdquo;
      </p>
    </Link>
  );
}
