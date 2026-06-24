export function RegistryCard({
  label,
  title,
  meta,
  spine = false,
  children,
}: {
  label: string;
  title: string;
  meta?: string;
  spine?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <article
      className={`manuscript-glow rounded border border-outline-variant bg-surface-container-lowest p-stack-md ${
        spine ? "border-l-2 border-l-primary" : ""
      }`}
    >
      <p className="font-label text-caption uppercase tracking-[0.05em] text-secondary">
        {label}
      </p>
      <h3 className="mt-stack-sm font-headline text-headline-md text-primary">
        {title}
      </h3>
      {meta && <p className="mt-1 font-body text-body-md text-on-surface-variant">{meta}</p>}
      {children && <div className="mt-stack-md">{children}</div>}
    </article>
  );
}
