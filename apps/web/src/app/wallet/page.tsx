import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
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

  return (
    <main className="mx-auto max-w-[1120px] px-margin-mobile py-stack-lg md:px-margin-page">
      <h1 className="font-display text-display-lg text-primary">My Credentials</h1>
      <p className="mt-stack-sm font-body text-body-md italic text-on-surface-variant">
        Each entry is sealed in the registry. Personal data never leaves this folio.
      </p>
      {credentials.length === 0 ? (
        <p className="mt-stack-lg font-body text-body-md">No credentials yet.</p>
      ) : (
        <div className="mt-stack-lg grid grid-cols-1 gap-gutter md:grid-cols-2">
          {credentials.map((c) => (
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
            />
          ))}
        </div>
      )}
    </main>
  );
}
