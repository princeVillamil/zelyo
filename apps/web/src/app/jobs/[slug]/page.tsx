import { notFound } from "next/navigation";
import { getGate } from "../../../server/jobgate.service";
import { ClaimPanel } from "./ClaimPanel";

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

  const proveHref = "/wallet";

  return (
    <main className="mx-auto max-w-[1120px] px-margin-mobile py-stack-lg md:px-margin-page">
      <p className="font-label text-label-md uppercase text-secondary">Registry Gate</p>
      <h1 className="font-display text-display-lg text-on-background mt-stack-sm">{gate.title}</h1>
      <p className="font-body text-body-md text-on-surface-variant mt-stack-md max-w-2xl">
        {gate.description}
      </p>
      <p className="font-mono text-caption text-on-surface-variant mt-stack-md">
        This gate discloses only: {gate.requiredPredicate.attribute} ==
        &ldquo;{gate.requiredPredicate.equals}&rdquo;. All other credential data stays private.
      </p>
      <div className="mt-stack-lg">
        <ClaimPanel
          gate={gate}
          proveHref={proveHref}
          initialTxHash={txHash ?? null}
          initialNullifierHex={nullifierHex ?? null}
          initialBoundAddress={boundAddress ?? null}
        />
      </div>
    </main>
  );
}
