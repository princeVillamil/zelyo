import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { KeysManager } from "@/components/wallet/KeysManager";

export default async function KeysPage() {
  const session = await auth();
  if (!session || session.user.role !== "HOLDER") redirect("/login");

  const holderKey = await db.holderKey.findUnique({
    where: { userId: session.user.id },
  });

  return (
    <main className="py-stack-lg">
      <p className="font-label text-[11px] tracking-[0.14em] uppercase text-secondary">Holder Wallet</p>
      <h1 className="font-display text-display-lg text-primary mt-stack-sm">Identity Keys</h1>
      <p className="mt-stack-sm font-body text-body-md text-on-surface-variant">
        Your identity secret lives only in this browser. Export a backup to keep it safe — Zelyo
        only ever learns your public commitment.
      </p>
      <div className="mt-stack-lg">
        <KeysManager initialCommitment={holderKey?.idCommitment ?? null} />
      </div>
    </main>
  );
}


