export function SchematicFigure({
  caption,
  nodes,
}: {
  caption: string;
  nodes: string[];
}) {
  return (
    <figure className="rounded border border-outline-variant p-stack-md">
      <div className="flex flex-wrap items-center gap-stack-sm">
        {nodes.map((node, i) => (
          <span key={node} className="flex items-center gap-stack-sm">
            <span className="rounded border border-outline px-stack-sm py-2 font-label text-label-md uppercase tracking-[0.05em] text-on-surface">
              {node}
            </span>
            {i < nodes.length - 1 && (
              <span aria-hidden className="text-secondary">
                →
              </span>
            )}
          </span>
        ))}
      </div>
      <figcaption className="mt-stack-sm font-label text-caption uppercase tracking-[0.05em] text-secondary">
        {caption}
      </figcaption>
    </figure>
  );
}
