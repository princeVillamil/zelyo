import { notFound } from "next/navigation";
import { getGate } from "../../../server/jobgate.service";
import { ClaimPanel } from "./ClaimPanel";
import { PrivacyPanel } from "./PrivacyPanel";
import { db } from "@/lib/db";

// Reads live gate data — render on-demand, never prerender at build.
export const dynamic = "force-dynamic";

export default async function GateDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ txHash?: string; nullifier?: string; address?: string }>;
}) {
  const { slug } = await params;
  const { txHash, nullifier: nullifierHex, address: boundAddress } = await searchParams;
  const gate = await getGate(slug);
  if (!gate) notFound();

  // Carry the gate slug into the wallet so proving can loop back here to claim.
  const proveHref = `/wallet?gate=${encodeURIComponent(slug)}`;

  let disclosedRaw: Record<string, string> = {};

  if (txHash && nullifierHex && boundAddress) {
    const verification = await db.verification.findFirst({
      where: { txHash, nullifierHex, boundStellarAddress: boundAddress, result: "VERIFIED" },
      orderBy: { createdAt: "desc" },
      include: { jobGate: { select: { slug: true } } },
    });
    if (verification && verification.jobGate?.slug === slug) {
      disclosedRaw = (verification.disclosed as { raw?: Record<string, string> }).raw ?? {};
    }
  }

  const isExpired = gate.expiresAt ? new Date() > new Date(gate.expiresAt) : false;

  return (
    <main className="mx-auto max-w-[1120px] px-margin-mobile py-stack-lg md:px-margin-page">
      <p className="font-label text-label-md uppercase text-secondary">Registry Gate</p>
      <h1 className="font-display text-display-lg text-on-background mt-stack-sm">{gate.title}</h1>
      <p className="font-body text-body-md text-on-surface-variant mt-stack-md max-w-2xl">
        {gate.description}
      </p>
      <div className="mt-stack-sm space-y-1">
        {gate.requiredPredicates.map((pred, i) => (
          <p key={i} className="font-mono text-caption text-on-surface-variant">
            {i > 0 ? "AND " : ""}This gate discloses only: {pred.attribute} ==
            &ldquo;{pred.equals}&rdquo;
          </p>
        ))}
      </div>
      {gate.expiresAt && (
        <p className="font-mono text-caption text-on-surface-variant mt-stack-sm">
          {isExpired ? "Expired" : "Expires"}: {new Date(gate.expiresAt).toLocaleString()}
        </p>
      )}
      {Object.keys(disclosedRaw).length > 0 && (
        <div className="mt-stack-lg">
          <PrivacyPanel
            disclosed={disclosedRaw}
            boundAddress={boundAddress ?? ""}
            nullifier={nullifierHex ?? ""}
          />
        </div>
      )}
      <div className="mt-stack-lg">
        <ClaimPanel
          gate={gate}
          proveHref={proveHref}
          initialTxHash={txHash ?? null}
          initialNullifierHex={nullifierHex ?? null}
          initialBoundAddress={boundAddress ?? null}
          isExpired={isExpired}
        />
      </div>
    </main>
  );
}
