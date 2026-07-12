import { GateCard } from "../../components/GateCard";
import { Pagination } from "../../components/Pagination";
import { listGates } from "../../server/jobgate.service";

// Public board reads live registry data — render on-demand, never prerender at build.
export const dynamic = "force-dynamic";

interface JobsPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const { page } = await searchParams;
  const currentPage = Math.max(1, parseInt(page || "1", 10));
  const limit = 10;

  const gates = await listGates();
  const totalGates = gates.length;
  const totalPages = Math.ceil(totalGates / limit);
  const paginatedGates = gates.slice((currentPage - 1) * limit, currentPage * limit);

  return (
    <main className="py-stack-lg">
      <p className="font-label text-[11px] tracking-[0.14em] uppercase text-secondary">The Public Board</p>
      <h1 className="font-display text-display-lg text-primary mt-stack-sm">Verified Gates</h1>
      <p className="font-body text-body-md text-on-surface-variant mt-stack-sm">
        Each gate opens to a single proven fact — nothing more is disclosed.
      </p>
      {paginatedGates.length === 0 ? (
        <p className="mt-stack-lg font-body text-body-md">No gates found on this page.</p>
      ) : (
        <>
          <div className="mt-stack-lg grid gap-gutter md:grid-cols-2">
            {paginatedGates.map((gate) => (
              <GateCard key={gate.slug} gate={gate} />
            ))}
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} baseUrl="/jobs" />
        </>
      )}
    </main>
  );
}

