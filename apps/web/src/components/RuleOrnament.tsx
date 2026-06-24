export function RuleOrnament() {
  return (
    <div role="separator" className="my-stack-md flex items-center gap-stack-sm">
      <span className="h-px flex-1 bg-outline-variant" />
      <span aria-hidden className="text-secondary">
        ◆
      </span>
      <span className="h-px flex-1 bg-outline-variant" />
    </div>
  );
}
