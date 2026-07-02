import { notFound } from "next/navigation";
import { ExplorerRevealPanel } from "../../../../components/ExplorerRevealPanel";
import { getVerificationByTxHash } from "../../../../server/verification-read.service";
import { PrivacyPanel } from "../../../jobs/[slug]/PrivacyPanel";

// Reads a live verification mirror row — render on-demand, never prerender at build.
export const dynamic = "force-dynamic";

export default async function VerifyResultPage({
  params,
}: {
  params: Promise<{ txHash: string }>;
}) {
  const { txHash } = await params;
  const view = await getVerificationByTxHash(txHash);
  if (!view) notFound();

  return (
    <main className="py-stack-lg">
      <p className="font-label text-label-md uppercase text-secondary">Verification Record</p>
      <h1 className="font-display text-display-lg text-on-background mt-stack-sm">
        Sealed &amp; Attested
      </h1>
      <p className="font-body text-body-md italic text-on-surface-variant mt-stack-sm">
        Cryptographically sealed via the Zelyo Protocol.
      </p>
      <div className="mt-stack-lg">
        <ExplorerRevealPanel view={view} />
      </div>
      {view.result === "VERIFIED" && Object.keys(view.disclosedRaw).length > 0 && (
        <div className="mt-stack-lg">
          <PrivacyPanel
            disclosed={view.disclosedRaw}
            boundAddress={view.boundAddress}
            nullifier={view.nullifierHex}
          />
        </div>
      )}
      {view.result === "VERIFIED" && (
        <div className="mt-stack-md">
          <a
            href="/jobs"
            className="foil-stamp inline-flex items-center rounded px-stack-md py-3 font-label text-label-md uppercase text-on-primary hover:-translate-y-px transition-transform"
          >
            Browse Reward Gates
          </a>
        </div>
      )}
    </main>
  );
}
