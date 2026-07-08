export function RuleOrnament({ className = "my-stack-md" }: { className?: string }) {
  return (
    <div role="separator" className={`${className} flex items-center gap-stack-md`}>
      <span className="h-px flex-1 bg-outline-variant" />
      <span aria-hidden className="text-secondary text-[10px]">
        ◆
      </span>
      <span className="h-px flex-1 bg-outline-variant" />
    </div>
  );
}

