import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getMerkleProof } from "@/server/merkle.service";
import { ProvePanel } from "@/components/wallet/ProvePanel";

export default async function ProvePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ gate?: string }>;
}) {
  const session = await auth();
  if (!session || session.user.role !== "HOLDER") redirect("/login");
  const { id } = await params;
  const { gate } = await searchParams;

  const holderKey = await db.holderKey.findUnique({ where: { userId: session.user.id } });
  const cred = holderKey
    ? await db.credential.findFirst({ where: { id, holderKeyId: holderKey.id } })
    : null;
  if (!cred) notFound();

  const proof = await getMerkleProof(cred.leafIndex);

  return (
    <main className="mx-auto max-w-[1120px] px-margin-mobile py-stack-lg md:px-margin-page">
      <h1 className="font-display text-display-lg text-primary">Seal a Proof</h1>
      <p className="mt-stack-sm font-body text-body-md italic text-on-surface-variant">
        Cryptographically sealed via the Zelyo Protocol — nothing personal leaves this device.
      </p>
      <div className="mt-stack-lg">
        <ProvePanel
          credential={{
            id: cred.id,
            attributes: cred.attributes as never,
            leafIndex: cred.leafIndex,
            merklePath: { siblings: proof.siblings, pathIndices: proof.pathIndices },
            root: proof.rootHex,
          }}
          gate={gate}
        />
      </div>
    </main>
  );
}
