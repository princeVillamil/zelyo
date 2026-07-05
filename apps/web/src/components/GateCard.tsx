import Link from "next/link";
import { StatusPill } from "./StatusPill";
import type { GateSummary } from "../server/jobgate.service";

export function GateCard({ gate }: { gate: GateSummary }) {
  // A public listing, not a sealed folio: flat/light surface, hairline outline, and a
  // status pill in the header. The deep-green foil-stamp fill is reserved for the wallet.
  const expired = gate.expiresAt ? new Date() > new Date(gate.expiresAt) : false;
  return (
    <Link
      href={`/jobs/${gate.slug}`}
      className="group flex flex-col justify-between rounded-lg border border-outline-variant bg-surface-container-lowest p-stack-md transition-transform transition-colors hover:-translate-y-px hover:border-primary manuscript-glow h-full"
    >
      {/* Top half: header info and title/description */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between gap-gutter mb-stack-sm">
          <p className="font-label text-label-md uppercase text-secondary flex items-center gap-1.5">
            <span className="text-[10px] text-primary" aria-hidden="true">◆</span>
            Registry Gate
          </p>
          <StatusPill tone={expired ? "error" : "primary"} label={expired ? "Expired" : "Open"} />
        </div>
        <h3 className="font-headline text-headline-md text-on-background">{gate.title}</h3>
        <p className="font-body text-body-md text-on-surface-variant mt-stack-sm flex-1">{gate.description}</p>
      </div>

      {/* Middle/Bottom: Predicates spec box separated by a quiet ◆ rule and locked footer */}
      <div className="mt-stack-md">
        <div className="flex items-center gap-2 text-outline-variant my-stack-sm select-none" aria-hidden="true">
          <div className="h-[1px] flex-1 bg-outline-variant/30" />
          <span className="text-[10px]">◆</span>
          <div className="h-[1px] flex-1 bg-outline-variant/30" />
        </div>
        
        {/* The single fact this gate opens to — framed as a spec, not a personal seal. */}
        <div className="space-y-1 border-l-2 border-primary bg-surface-container px-stack-md py-stack-sm rounded-r">
          {gate.requiredPredicates.map((pred, i) => (
            <p key={i} className="font-mono text-caption text-on-surface-variant">
              {pred.attribute} == &ldquo;{pred.equals}&rdquo;{i < gate.requiredPredicates.length - 1 ? " AND" : ""}
            </p>
          ))}
        </div>

        {/* Expiration date footer - locked to the bottom to prevent layout shifting */}
        <div className="mt-stack-md pt-stack-sm border-t border-outline-variant/30 flex justify-between items-center text-caption text-on-surface-variant">
          <span className="font-label text-[11px] uppercase text-secondary">Registry Expiration</span>
          <span className="font-mono">
            {gate.expiresAt ? new Date(gate.expiresAt).toLocaleDateString() : "Indefinite"}
          </span>
        </div>
      </div>
    </Link>
  );
}

