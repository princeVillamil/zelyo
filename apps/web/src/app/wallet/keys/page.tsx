import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { KeysManager } from "@/components/wallet/KeysManager";

export default async function KeysPage() {
  const session = await auth();
  if (!session || session.user.role !== "HOLDER") redirect("/login");

  return (
    <main className="py-stack-lg">
      <p className="font-label text-label-md uppercase text-secondary">Holder Wallet</p>
      <h1 className="font-display text-display-lg text-on-background mt-stack-sm">Identity Keys</h1>
      <p className="mt-stack-sm font-body text-body-md italic text-on-surface-variant">
        Your identity secret lives only in this browser. Export a backup to keep it safe — Zelyo
        only ever learns your public commitment.
      </p>
      <div className="mt-stack-lg max-w-[640px]">
        <KeysManager />
      </div>
    </main>
  );
}


