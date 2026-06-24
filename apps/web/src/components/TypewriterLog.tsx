"use client";

export type LogLine = { time: string; event: string; status: string };

export function TypewriterLog({ lines }: { lines: LogLine[] }) {
  return (
    <div
      role="log"
      aria-live="polite"
      className="typewriter rounded bg-surface-container-high p-stack-md text-body-md text-on-surface"
    >
      {lines.map((l, i) => (
        <div
          key={i}
          className="border-b border-outline-variant/40 py-1 last:border-b-0"
        >
          <span className="text-secondary">[{l.time}]</span> {l.event} …{" "}
          <span className="text-primary">{l.status}</span>
        </div>
      ))}
      <span className="inline-block w-2 animate-pulse text-primary motion-reduce:animate-none">
        ▍
      </span>
    </div>
  );
}
