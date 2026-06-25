import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { VcDownloadButton } from "@/components/wallet/VcDownloadButton";

export default async function CredentialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session || session.user.role !== "HOLDER") redirect("/login");
  const { id } = await params;

  const holderKey = await db.holderKey.findUnique({ where: { userId: session.user.id } });
  const cred = holderKey
    ? await db.credential.findFirst({
        where: { id, holderKeyId: holderKey.id },
        include: { issuer: true, leaf: true },
      })
    : null;
  if (!cred) notFound();

  const a = cred.attributes as { courseName: string; track: string; issueDate: string };

  return (
    <main className="mx-auto max-w-[1120px] px-margin-mobile py-stack-lg md:px-margin-page">
      <h1 className="font-display text-display-lg text-primary">{a.courseName}</h1>
      <dl className="mt-stack-lg space-y-stack-md font-body text-body-md">
        <div><dt className="font-label text-label-md uppercase text-secondary">Track</dt><dd>{a.track}</dd></div>
        <div><dt className="font-label text-label-md uppercase text-secondary">Issuer</dt><dd>{cred.issuer.name}</dd></div>
        <div><dt className="font-label text-label-md uppercase text-secondary">Issued</dt><dd>{a.issueDate}</dd></div>
        <div><dt className="font-label text-label-md uppercase text-secondary">Root at issuance</dt><dd className="typewriter break-all">{cred.merkleRootHex}</dd></div>
        <div><dt className="font-label text-label-md uppercase text-secondary">Leaf signature</dt><dd className="typewriter break-all">{cred.leaf.leafHex}</dd></div>
      </dl>
      <div className="mt-stack-lg flex gap-gutter">
        <VcDownloadButton credentialId={cred.id} />
        <Link className="font-label text-label-md uppercase text-primary underline self-center" href={`/wallet/prove/${cred.id}`}>
          Prove a fact
        </Link>
      </div>
    </main>
  );
}
