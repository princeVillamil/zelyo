import { notFound } from "next/navigation";
import { ProofReceipt } from "../../../../components/ProofReceipt";
import { PrivacyToggle } from "../../../../components/PrivacyToggle";
import { getVerificationByTxHash } from "../../../../server/verification-read.service";
import { db } from "@/lib/db";

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

  const showPrivacy =
    view.result === "VERIFIED" && Object.keys(view.disclosedRaw).length > 0;

  // The before/after toggle contrasts the holder's own credential values with what
  // the proof revealed. Demo-only exposure: values ride on a bearer URL (txHash).
  let attributes: Record<string, string> | null = null;
  if (showPrivacy && view.credentialId) {
    const credential = await db.credential.findUnique({
      where: { id: view.credentialId },
      select: { attributes: true },
    });
    attributes = (credential?.attributes as Record<string, string> | null) ?? null;
  }

  return (
    <main className="py-stack-lg">
      <p className="font-label text-label-md uppercase text-secondary">Verification Record</p>
      <h1 className="font-display text-display-lg text-on-background mt-stack-sm">
        Sealed &amp; Attested
      </h1>
      <p className="font-body text-body-md italic text-on-surface-variant mt-stack-sm">
        Cryptographically sealed via the Zelyo Protocol.
      </p>
      {/* Verified record leads (70%); the privacy summary is a slim companion (30%). When
          nothing is disclosed there's no summary, so the record spans the full width. */}
      <div
        className={`mt-stack-lg grid items-start gap-gutter ${
          showPrivacy ? "md:grid-cols-[7fr_3fr]" : ""
        }`}
      >
        <ProofReceipt view={view} />
        {showPrivacy && (
          <PrivacyToggle
            attributes={attributes}
            disclosed={view.disclosedRaw}
            boundAddress={view.boundAddress}
            nullifier={view.nullifierHex}
          />
        )}
      </div>
    </main>
  );
}
