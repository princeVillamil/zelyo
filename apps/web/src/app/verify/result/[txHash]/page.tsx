import { notFound } from "next/navigation";
import { ExplorerRevealPanel } from "../../../../components/ExplorerRevealPanel";
import { getVerificationByTxHash } from "../../../../server/verification-read.service";

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
    <main className="mx-auto max-w-[1120px] px-margin-mobile py-stack-lg md:px-margin-page">
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
    </main>
  );
}
