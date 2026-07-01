import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isCredentialOrphaned } from "@/lib/orphan";
import { getGate } from "@/server/jobgate.service";
import { CredentialCard } from "@/components/wallet/CredentialCard";

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ gate?: string }>;
}) {
  const session = await auth();
  if (!session || session.user.role !== "HOLDER") redirect("/login");

  const { gate } = await searchParams;
  // When arriving from a gate, load it so we can (a) title the page and (b) tell whether
  // an existing proof already satisfies it — letting the holder claim without re-proving.
  const gateDetail = gate ? await getGate(gate) : null;
  const gateExpired = gateDetail?.expiresAt ? new Date() > new Date(gateDetail.expiresAt) : false;

  const holderKey = await db.holderKey.findUnique({ where: { userId: session.user.id } });
  const credentials = holderKey
    ? await db.credential.findMany({
        where: { holderKeyId: holderKey.id },
        include: { issuer: true, leaf: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  // A credential is "proven" once it has a VERIFIED verification. There's no Prisma
  // relation (credentialId is a bare column), so resolve it in one batched query and
  // keep the latest proof per credential — enough to reuse it for a claim.
  const provenByCred = new Map<
    string,
    {
      txHash: string | null;
      nullifierHex: string;
      boundStellarAddress: string | null;
      disclosed: Record<string, string>;
      provenAt: Date;
    }
  >();
  if (credentials.length > 0) {
    const proofs = await db.verification.findMany({
      where: { credentialId: { in: credentials.map((c) => c.id) }, result: "VERIFIED" },
      select: {
        credentialId: true,
        txHash: true,
        nullifierHex: true,
        boundStellarAddress: true,
        disclosed: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    for (const p of proofs) {
      if (!p.credentialId || provenByCred.has(p.credentialId)) continue; // first row = latest
      const raw = (p.disclosed as { raw?: Record<string, string> }).raw ?? {};
      provenByCred.set(p.credentialId, {
        txHash: p.txHash,
        nullifierHex: p.nullifierHex,
        boundStellarAddress: p.boundStellarAddress,
        disclosed: raw,
        provenAt: p.createdAt,
      });
    }
  }

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
      {gateDetail && (
        <p
          className="mt-stack-md border-l-4 border-primary bg-primary/10 px-stack-md py-stack-sm font-body text-body-md text-on-background"
        >
          Claiming <span className="font-label uppercase text-primary">{gateDetail.title}</span>
          {gateExpired
            ? " — this gate has expired and is no longer accepting claims."
            : " — prove the required fact, or use an existing proof if one already qualifies."}
        </p>
      )}
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
          {decorated.map(({ c, orphaned }) => {
            const p = provenByCred.get(c.id);
            // Offer a one-click claim only when an existing proof actually satisfies this
            // gate — same predicate check claimGate enforces, so the button never dead-ends.
            let claimHref: string | undefined;
            if (
              p?.txHash &&
              p.boundStellarAddress &&
              gate &&
              gateDetail &&
              !gateExpired &&
              gateDetail.requiredPredicates.every((pred) => p.disclosed[pred.attribute] === pred.equals)
            ) {
              const params = new URLSearchParams({
                txHash: p.txHash,
                nullifier: p.nullifierHex,
                address: p.boundStellarAddress,
              });
              claimHref = `/jobs/${gate}?${params.toString()}`;
            }
            return (
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
                gate={gate}
                proof={
                  p
                    ? { txHash: p.txHash, disclosed: Object.keys(p.disclosed), provenAt: p.provenAt }
                    : undefined
                }
                claimHref={claimHref}
              />
            );
          })}
        </div>
      )}
    </main>
  );
}
