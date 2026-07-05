export function StatusPill({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "error" | "primary";
}) {
  const toneClass =
    tone === "error"
      ? "border-error text-error"
      : tone === "primary"
        ? "border-primary text-primary"
        : "border-outline-variant text-on-surface-variant";
  return (
    <span
      className={`inline-flex items-center rounded border px-stack-sm py-1 font-label text-label-md uppercase tracking-[0.05em] ${toneClass}`}
    >
      {label}
    </span>
  );
}
