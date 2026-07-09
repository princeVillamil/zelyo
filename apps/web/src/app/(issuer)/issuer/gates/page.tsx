import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { GateForm } from "./GateForm";

export const metadata = { title: "Gate Management — Zelyo" };

export default async function IssuerGatesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/login");

  return (
    <main className="py-stack-lg">
      <p className="font-label text-[11px] tracking-[0.14em] uppercase text-secondary">Issuer Portal</p>
      <h1 className="font-display text-display-lg text-primary mt-stack-sm">Gate Registry</h1>
      <p className="mt-stack-sm font-body text-body-md text-on-surface-variant">
        Create and manage reward gates for the public board. Each gate opens to a specific proven fact.
      </p>
      <div className="mt-stack-lg">
        <GateForm />
      </div>
    </main>
  );
}
