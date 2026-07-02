import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getCurrentRoot } from "@/server/merkle.service";

export const metadata = { title: "Issuer Dashboard — Zelyo" };

export default async function IssuerDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/login");

  const [issued, rootHex, lastPublish] = await Promise.all([
    db.credential.count({ where: { status: "ACTIVE" } }),
    getCurrentRoot(),
    db.rootHistory.findFirst({ orderBy: { publishedAt: "desc" }, select: { txHash: true, publishedAt: true } }),
  ]);

  return (
    <main className="py-stack-lg">
      <p className="font-label text-label-md uppercase text-secondary">Issuer Portal</p>
      <h1 className="font-display text-display-lg text-on-background mb-stack-md">The Archivist&rsquo;s Desk</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        <Stat label="Credentials Issued" value={String(issued)} />
        <Stat label="Current Root" value={rootHex.slice(0, 10) + "…" + rootHex.slice(-6)} mono />
        <Stat label="Last Publish Tx" value={lastPublish?.txHash ? lastPublish.txHash.slice(0, 10) + "…" : "—"} mono />
      </div>
      <a href="/issuer/mint"
        className="foil-stamp inline-block mt-stack-lg rounded px-stack-md py-stack-sm font-label text-label-md uppercase text-on-primary hover:-translate-y-px transition-transform">
        Mint New Credential
      </a>
    </main>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border border-outline-variant rounded-lg p-stack-md surface-container-lowest manuscript-glow">
      <div className="font-label text-label-md uppercase text-secondary">{label}</div>
      <div className={`mt-stack-sm text-headline-md text-primary ${mono ? "typewriter text-body-lg" : "font-display"}`}>{value}</div>
    </div>
  );
}
