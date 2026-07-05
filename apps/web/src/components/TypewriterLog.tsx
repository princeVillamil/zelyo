"use client";

import { useEffect, useRef } from "react";

export type LogLine = { time: string; event: string; status: string };

export function TypewriterLog({
  lines,
  title = "Zelyo · Prove Console",
  className = "",
  ...props
}: { lines: LogLine[]; title?: string } & React.HTMLAttributes<HTMLDivElement>) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div
      role="log"
      aria-live="polite"
      {...props}
      className={`typewriter rounded-lg border border-outline-variant bg-surface-container-high p-6 text-on-surface text-[13px] leading-6 tracking-[-0.3px] font-mono h-[340px] flex flex-col justify-between ${className}`}
    >
      {/* Header bar from homepage/index.html style */}
      <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-outline-variant select-none shrink-0" aria-hidden="true">
        <span className="font-label text-[11px] tracking-[0.14em] uppercase text-secondary font-semibold">
          {title}
        </span>
        <span className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-secondary-fixed-dim" />
          <span className="w-2 h-2 rounded-full bg-secondary-fixed-dim" />
          <span className="w-2 h-2 rounded-full bg-secondary-fixed-dim" />
        </span>
      </div>

      {/* Log lines */}
      <div ref={scrollRef} className="flex-1 space-y-1 overflow-y-auto pr-1">
        {lines.map((l, i) => {
          const isErr = l.event === "ERROR";
          return (
            <div key={i} className={`line whitespace-pre-wrap break-words ${isErr ? "text-error font-semibold" : ""}`}>
              <span className={isErr ? "text-error font-semibold" : "text-secondary font-normal"}>[{l.time}]</span>{" "}
              {isErr ? (
                <span>{l.event} … {l.status}</span>
              ) : (
                <>
                  {l.event} …{" "}
                  <span className={l.status === "FAIL" || l.status === "ERROR" || l.status === "FAILED" ? "text-error font-semibold" : "text-primary font-semibold"}>
                    {l.status}
                  </span>
                </>
              )}
            </div>
          );
        })}
        {/* Blinking typewriter cursor */}
        <span className="inline-block w-2 h-4 bg-primary align-[-2px] ml-0.5 animate-pulse" />
      </div>
    </div>
  );
}



