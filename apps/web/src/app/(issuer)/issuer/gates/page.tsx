import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listGates } from "@/server/jobgate.service";
import { GateForm } from "./GateForm";

export const metadata = { title: "Gate Management — Zelyo" };

export default async function IssuerGatesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/login");

  const gates = await listGates();

  return (
    <main className="mx-auto max-w-[1120px] px-margin-mobile py-stack-lg md:px-margin-page">
      <p className="font-label text-label-md uppercase text-secondary">Gate Management</p>
      <h1 className="font-display text-display-lg text-primary mt-stack-sm">Gate Registry</h1>
      <p className="font-body text-body-md italic text-on-surface-variant mt-stack-sm max-w-2xl">
        Create and manage reward gates for the public board. Each gate opens to a specific proven fact.
      </p>
      <div className="mt-stack-lg">
        <GateForm />
      </div>
      {gates.length > 0 && (
        <div className="mt-stack-lg">
          <h2 className="font-label text-label-md uppercase text-secondary mb-stack-md">Active Gates</h2>
          <div className="grid gap-gutter md:grid-cols-2">
            {gates.map((gate) => (
              <a
                key={gate.slug}
                href={`/jobs/${gate.slug}`}
                className="block border border-outline-variant bg-surface-container-lowest rounded-lg p-stack-md hover:opacity-90 transition-opacity"
              >
                <p className="font-label text-label-md uppercase text-secondary">Registry Gate</p>
                <h3 className="font-headline text-headline-md text-on-background mt-stack-sm">{gate.title}</h3>
                <p className="font-body text-body-md text-on-surface-variant mt-stack-sm">{gate.description}</p>
                <div className="mt-stack-sm space-y-1">
                  {gate.requiredPredicates.map((pred, i) => (
                    <p key={i} className="font-mono text-caption text-on-surface-variant">
                      {pred.attribute} == &ldquo;{pred.equals}&rdquo;
                    </p>
                  ))}
                </div>
                {gate.expiresAt && (
                  <p className="font-mono text-caption text-on-surface-variant mt-stack-sm">
                    Expires: {new Date(gate.expiresAt).toLocaleDateString()}
                  </p>
                )}
              </a>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
