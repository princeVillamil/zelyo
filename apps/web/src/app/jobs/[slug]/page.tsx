import { notFound } from "next/navigation";
import { getGate } from "../../../server/jobgate.service";
import { listReceiveAssetChoices } from "../../../lib/stellar";
import { ClaimPanel } from "./ClaimPanel";
import { PrivacyToggle } from "../../../components/PrivacyToggle";
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
  let attributes: Record<string, string> | null = null;

  if (txHash && nullifierHex && boundAddress) {
    const verification = await db.verification.findFirst({
      where: { txHash, nullifierHex, boundStellarAddress: boundAddress, result: "VERIFIED" },
      orderBy: { createdAt: "desc" },
      include: { jobGate: { select: { slug: true } } },
    });
    if (verification && verification.jobGate?.slug === slug) {
      disclosedRaw = (verification.disclosed as { raw?: Record<string, string> }).raw ?? {};
      // Feed the before/after toggle the holder's own credential values (demo-only;
      // see the ROADMAP shortlist privacy note).
      if (verification.credentialId) {
        const credential = await db.credential.findUnique({
          where: { id: verification.credentialId },
          select: { attributes: true },
        });
        attributes = (credential?.attributes as Record<string, string> | null) ?? null;
      }
    }
  }

  const isExpired = gate.expiresAt ? new Date() > new Date(gate.expiresAt) : false;

  // Asset choice is offered only when the gate pays native XLM (the SDEX conversion
  // source); the whitelist itself comes from SDEX_RECEIVE_ASSETS.
  const gateAsset = gate.rewardConfig.asset;
  const isXlmReward = gateAsset?.code === "XLM" && !gateAsset.issuer;
  const receiveChoices =
    gate.rewardType === "CLAIMABLE_BALANCE" && isXlmReward
      ? listReceiveAssetChoices().filter((c) => !(c.code === "XLM" && !c.issuer))
      : [];

  return (
    <main className="py-stack-lg">
      <p className="font-label text-label-md uppercase text-secondary">Registry Gate</p>
      <h1 className="font-display text-display-lg text-on-background mt-stack-sm">{gate.title}</h1>
      <p className="font-body text-body-md text-on-surface-variant mt-stack-md max-w-2xl">
        {gate.description}
      </p>
      <div className="mt-stack-sm space-y-1 border-l-2 border-primary bg-surface-container px-stack-md py-stack-sm rounded-r">
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
          <PrivacyToggle
            attributes={attributes}
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
          receiveChoices={receiveChoices}
        />
      </div>
    </main>
  );
}
