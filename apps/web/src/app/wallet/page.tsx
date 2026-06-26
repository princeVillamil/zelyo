import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isCredentialOrphaned } from "@/lib/orphan";
import { CredentialCard } from "@/components/wallet/CredentialCard";

export default async function WalletPage() {
  const session = await auth();
  if (!session || session.user.role !== "HOLDER") redirect("/login");

  const holderKey = await db.holderKey.findUnique({ where: { userId: session.user.id } });
  const credentials = holderKey
    ? await db.credential.findMany({
        where: { holderKeyId: holderKey.id },
        include: { issuer: true, leaf: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  // Flag credentials minted under a previous identity (key was replaced); they can
  // no longer be proven from this device until that identity is restored.
  const decorated = credentials.map((c) => ({
    c,
    orphaned: isCredentialOrphaned({
      currentCommitment: holderKey?.idCommitment,
      status: c.status,
      attributes: c.attributes,
      leafHex: c.leaf.leafHex,
    }),
  }));
  const orphanCount = decorated.filter((d) => d.orphaned).length;

  return (
    <main className="mx-auto max-w-[1120px] px-margin-mobile py-stack-lg md:px-margin-page">
      <h1 className="font-display text-display-lg text-primary">My Credentials</h1>
      <p className="mt-stack-sm font-body text-body-md italic text-on-surface-variant">
        Each entry is sealed in the registry. Personal data never leaves this folio.
      </p>
      {orphanCount > 0 && (
        <p
          role="alert"
          className="mt-stack-md border-l-4 border-error bg-error-container/40 px-stack-md py-stack-sm font-body text-body-md text-on-error-container"
        >
          {orphanCount} credential{orphanCount > 1 ? "s were" : " was"} issued to a previous
          identity and can no longer be proven from this device. Restore that identity from its
          backup blob on the{" "}
          <a className="underline" href="/wallet/keys">
            Identity Keys
          </a>{" "}
          page to make {orphanCount > 1 ? "them" : "it"} provable again.
        </p>
      )}
      {credentials.length === 0 ? (
        <p className="mt-stack-lg font-body text-body-md">No credentials yet.</p>
      ) : (
        <div className="mt-stack-lg grid grid-cols-1 gap-gutter md:grid-cols-2">
          {decorated.map(({ c, orphaned }) => (
            <CredentialCard
              key={c.id}
              credential={{
                id: c.id,
                status: c.status,
                issuerName: c.issuer.name,
                attributes: c.attributes as never,
                leafIndex: c.leafIndex,
              }}
              signatureHash={c.leaf.leafHex}
              orphaned={orphaned}
            />
          ))}
        </div>
      )}
    </main>
  );
}
