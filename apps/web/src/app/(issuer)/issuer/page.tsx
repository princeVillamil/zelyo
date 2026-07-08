import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getCurrentRoot } from "@/server/merkle.service";
import { RevokeButton } from "./credentials/RevokeButton";

export const metadata = { title: "Issuer Dashboard — Zelyo" };

interface IssuerDashboardProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function IssuerDashboard({ searchParams }: IssuerDashboardProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/login");

  const { q } = await searchParams;

  const [issued, rootHex, lastPublish] = await Promise.all([
    db.credential.count({ where: { status: "ACTIVE" } }),
    getCurrentRoot(),
    db.rootHistory.findFirst({ orderBy: { publishedAt: "desc" }, select: { txHash: true, publishedAt: true } }),
  ]);

  const where = q ? { OR: [{ id: { contains: q } }, { merkleRootHex: { contains: q } }] } : {};
  const items = await db.credential.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, leafIndex: true, merkleRootHex: true, status: true, createdAt: true },
  });

  return (
    <main className="py-stack-lg">
      <p className="font-label text-[11px] tracking-[0.14em] uppercase text-secondary">Issuer Portal</p>
      <h1 className="font-display text-display-lg text-primary mt-stack-sm">The Archivist&rsquo;s Desk</h1>
      <p className="mt-stack-sm font-body text-body-md text-on-surface-variant">
        Publish cryptographic roots, monitor registrations, and manage the official registry.
      </p>

      <div className="mt-stack-lg grid grid-cols-1 gap-gutter lg:grid-cols-12">
        {/* Left Column: Stats & Actions */}
        <div className="lg:col-span-5 space-y-stack-md">
          <Stat label="Credentials Issued" value={String(issued)} />
          <Stat label="Current Root" value={rootHex.slice(0, 10) + "…" + rootHex.slice(-6)} mono />
          <Stat label="Last Publish Tx" value={lastPublish?.txHash ? lastPublish.txHash.slice(0, 10) + "…" : "—"} mono />
          
          <div className="pt-stack-sm">
            <a href="/issuer/mint"
              className="foil-stamp inline-block w-full text-center rounded px-stack-md py-stack-sm font-label text-label-md uppercase text-on-primary hover:-translate-y-px transition-transform">
              Mint New Credential
            </a>
          </div>
        </div>

        {/* Right Column: Folio Library */}
        <div className="lg:col-span-7">
          <div className="border border-outline-variant rounded-lg p-stack-md surface-container-lowest manuscript-glow flex flex-col h-[calc(100vh-380px)] min-h-[300px]">
            <h2 className="font-label text-label-md uppercase text-secondary mb-stack-sm">Folio Library</h2>
            
            <form className="mb-stack-md relative z-10" action="/issuer" method="get">
              <input name="q" defaultValue={q ?? ""} placeholder="Search by folio id or root…"
                className="w-full bg-transparent border-b border-outline focus:border-primary outline-none typewriter text-body-md py-unit" />
            </form>

            <ul className="space-y-stack-sm overflow-y-auto pr-unit flex-1 relative z-10">
              {items.length === 0 && <li className="font-body italic text-on-surface-variant bg-surface-container-lowest p-stack-sm border border-outline-variant rounded">No credentials issued yet.</li>}
              {items.map((c) => (
                <li key={c.id}
                  className="flex items-center justify-between gap-stack-md border border-outline-variant border-l-2 border-l-primary rounded p-stack-sm bg-surface-container-low shadow-sm">
                  <div className="min-w-0">
                    <div className="font-label text-[11px] tracking-[0.05em] uppercase text-secondary">Registry Entry No. {c.leafIndex.toLocaleString()}</div>
                    <div className="font-body text-body-sm text-on-surface truncate" title={c.id}>{c.id}</div>
                    <div className="typewriter text-caption text-on-surface-variant">root {c.merkleRootHex.slice(0, 14)}…</div>
                  </div>
                  <div className="flex items-center gap-stack-sm shrink-0">
                    <span className={`flex items-center gap-1.5 font-label text-[11px] tracking-[0.05em] uppercase ${c.status === "REVOKED" ? "text-error" : "text-primary"}`}>
                      <span className={`inline-block h-2 w-2 rounded-full ${c.status === "REVOKED" ? "bg-error" : "bg-primary animate-pulse"}`} />
                      {c.status}
                    </span>
                    {c.status === "ACTIVE" && <RevokeButton credentialId={c.id} />}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border border-outline-variant border-l-2 border-l-primary rounded-lg p-stack-md surface-container-lowest manuscript-glow">
      <div className="font-label text-label-md uppercase text-secondary">{label}</div>
      <div className={`mt-stack-sm text-headline-md text-primary ${mono ? "typewriter text-body-lg" : "font-display"}`}>{value}</div>
    </div>
  );
}
