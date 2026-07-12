export default function KeysLoading() {
  return (
    <main className="py-stack-lg animate-pulse">
      <p className="font-label text-[11px] tracking-[0.14em] uppercase text-secondary">Holder Wallet</p>
      <h1 className="font-display text-display-lg text-primary mt-stack-sm">Identity Keys</h1>
      <p className="mt-stack-sm font-body text-body-md text-on-surface-variant">
        Your identity secret lives only in this browser. Export a backup to keep it safe — Zelyo
        only ever learns your public commitment.
      </p>

      <div className="mt-stack-lg grid gap-gutter md:grid-cols-[1fr_auto] w-full">
        {/* Left Column: Inputs Skeleton */}
        <div className="space-y-stack-lg">
          <div className="space-y-stack-sm">
            <div className="h-4 w-32 bg-outline-variant/40 rounded" />
            <div className="h-10 w-full bg-outline-variant/20 border-b border-outline-variant/40" />
            <div className="h-4 w-72 bg-outline-variant/30 rounded mt-2" />
          </div>

          <div>
            <div className="h-12 w-48 bg-outline-variant/30 rounded" />
          </div>
        </div>

        {/* Right Column: Card Skeleton */}
        <article className="manuscript-glow relative rounded-lg border border-outline-variant bg-surface-container-lowest p-stack-lg text-on-background min-h-[350px] flex flex-col justify-between h-full min-w-0 w-full">
          <div>
            <div className="h-5 w-40 bg-outline-variant/40 rounded mb-4" />
            <div className="h-px bg-outline-variant/30 w-full mb-6" />

            <div className="space-y-stack-md">
              <div>
                <div className="h-4 w-44 bg-outline-variant/30 rounded mb-2" />
                <div className="h-10 w-full bg-surface-container-low border border-dashed border-outline-variant/40 rounded" />
              </div>

              <div>
                <div className="h-4 w-24 bg-outline-variant/30 rounded mb-2" />
                <div className="h-[120px] w-full bg-surface-container-low border border-dashed border-outline-variant/40 rounded animate-pulse" />
              </div>
            </div>
          </div>

          <div className="border-t border-outline-variant pt-4">
            <div className="flex justify-between items-center">
              <div className="h-4 w-12 bg-outline-variant/30 rounded" />
              <div className="h-4 w-28 bg-outline-variant/30 rounded" />
            </div>
          </div>
        </article>
      </div>
    </main>
  );
}
