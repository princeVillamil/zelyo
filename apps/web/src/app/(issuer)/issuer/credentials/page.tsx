import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { RevokeButton } from "./RevokeButton";

export const metadata = { title: "Folio Library — Zelyo" };

export default async function CredentialsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/login");

  const { q } = await searchParams;
  const where = q ? { OR: [{ id: { contains: q } }, { merkleRootHex: { contains: q } }] } : {};
  const items = await db.credential.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, leafIndex: true, merkleRootHex: true, status: true, createdAt: true },
  });

  return (
    <main className="py-stack-lg">
      <p className="font-label text-label-md uppercase text-secondary">Issuer Portal</p>
      <h1 className="font-display text-display-lg text-on-background mb-stack-md">Folio Library</h1>

      <form className="mb-stack-md" action="/issuer/credentials" method="get">
        <input name="q" defaultValue={q ?? ""} placeholder="Search by folio id or root…"
          className="w-full md:w-96 bg-transparent border-b border-outline focus:border-primary outline-none typewriter text-body-md py-unit" />
      </form>

      <ul className="space-y-stack-sm">
        {items.length === 0 && <li className="font-body italic text-on-surface-variant">No credentials issued yet.</li>}
        {items.map((c) => (
          <li key={c.id}
            className="flex items-center justify-between gap-stack-md border border-outline-variant border-l-2 border-l-primary rounded-lg p-stack-md surface-container-lowest">
            <div>
              <div className="font-label text-label-md uppercase text-secondary">Registry Entry No. {c.leafIndex.toLocaleString()}</div>
              <div className="font-body text-body-md text-on-surface">{c.id}</div>
              <div className="typewriter text-caption text-on-surface-variant">root {c.merkleRootHex.slice(0, 14)}…</div>
            </div>
            <div className="flex items-center gap-stack-md">
              <span className={`font-label text-label-md uppercase ${c.status === "REVOKED" ? "text-error" : "text-primary"}`}>
                {c.status}
              </span>
              {c.status === "ACTIVE" && <RevokeButton credentialId={c.id} />}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
