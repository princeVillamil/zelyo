import { GateCard } from "../../components/GateCard";
import { listGates } from "../../server/jobgate.service";

// Public board reads live registry data — render on-demand, never prerender at build.
export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const gates = await listGates();
  return (
    <main className="mx-auto max-w-[1120px] px-margin-mobile py-stack-lg md:px-margin-page">
      <p className="font-label text-label-md uppercase text-secondary">The Public Board</p>
      <h1 className="font-display text-display-lg text-on-background mt-stack-sm">Verified Gates</h1>
      <p className="font-body text-body-md italic text-on-surface-variant mt-stack-sm">
        Each gate opens to a single proven fact — nothing more is disclosed.
      </p>
      <div className="mt-stack-lg grid gap-gutter md:grid-cols-2">
        {gates.map((gate) => (
          <GateCard key={gate.slug} gate={gate} />
        ))}
      </div>
    </main>
  );
}
