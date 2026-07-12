"use client";

import { useState, type ReactNode } from "react";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  mintFormSchema,
  formValuesToMintInput,
  type MintFormValues,
} from "@/lib/schemas/credential";
import { TypewriterLog } from "@/components/TypewriterLog";

type LogLine = { ts: string; event: string; status: string; detail?: string };

export function MintForm() {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<MintFormValues>({
    resolver: zodResolver(mintFormSchema),
    defaultValues: { targetMode: "username", issueDate: new Date().toISOString().slice(0, 10) },
  });
  const [log, setLog] = useState<LogLine[]>([]);
  const [done, setDone] = useState<string | null>(null);
  const values = watch();
  const targetMode = watch("targetMode");

  async function onSubmit(values: MintFormValues) {
    setLog([]);
    setDone(null);
    const res = await fetch("/api/issuer/credentials", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(formValuesToMintInput(values)),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      setLog((l) => [...l, { ts: new Date().toISOString(), event: "ERROR", status: "FAIL", detail: body.error?.message ?? "Mint failed" }]);
      return;
    }
    const { id, jobId } = (await res.json()) as { id: string; jobId: string };
    const es = new EventSource(`/api/issuer/credentials/mint-log?jobId=${jobId}`);
    es.onmessage = (ev) => {
      try {
        const line = JSON.parse(ev.data) as LogLine;
        setLog((l) => [...l, line]);
      } catch {
        /* ignore */
      }
    };
    es.addEventListener("done", () => {
      setDone(id);
      es.close();
    });
  }

  function onInvalidSubmit(formErrors: FieldErrors<MintFormValues>) {
    const failedFields = Object.entries(formErrors)
      .map(([field, err]) => {
        const friendlyName = field.replace(/([A-Z])/g, " $1").trim();
        return `${friendlyName} is ${err?.message?.toLowerCase() ?? "required"}`;
      });

    setLog((currentLog) => [
      ...currentLog,
      {
        ts: new Date().toISOString(),
        event: "VALIDATE",
        status: `FAIL (${failedFields.join(", ")})`,
      },
    ]);
  }

  const consoleLines = log.length === 0
    ? [{ time: "--:--:--", event: "SYSTEM", status: "AWAITING AUTHORIZATION" }]
    : log.map((l) => ({
        time: new Date(l.ts).toISOString().slice(11, 19),
        event: l.event,
        status: l.status + (l.detail ? ` (${l.detail})` : ""),
      }));

  return (
    <div className="grid gap-gutter lg:grid-cols-[1fr_400px] w-full">
      <form onSubmit={handleSubmit(onSubmit, onInvalidSubmit)} className="space-y-stack-md">
        <Field label="Learner Full Name" error={errors.learnerName?.message}>
          <input {...register("learnerName")} aria-label="Learner full name"
            className="w-full bg-transparent border-b border-outline focus:border-primary outline-none font-body text-body-lg py-unit" />
        </Field>

        <Field label="Course of Study" error={errors.courseName?.message}>
          <input {...register("courseName")} aria-label="Course of study"
            className="w-full bg-transparent border-b border-outline focus:border-primary outline-none font-body text-body-lg py-unit" />
        </Field>

        <div className="grid grid-cols-2 gap-gutter">
          <Field label="Grade" error={errors.grade?.message}>
            <input {...register("grade")} aria-label="Grade"
              className="w-full bg-transparent border-b border-outline focus:border-primary outline-none font-body text-body-lg py-unit" />
          </Field>
          <Field label="Issue Date" error={errors.issueDate?.message}>
            <input type="date" {...register("issueDate")} aria-label="Issue date"
              className="w-full bg-transparent border-b border-outline focus:border-primary outline-none font-body text-body-lg py-unit" />
          </Field>
        </div>

        <Field label="Disclosed Predicate (Track)" error={errors.track?.message}>
          <input {...register("track")} aria-label="Disclosed predicate / track"
            className="w-full bg-transparent border-b border-outline focus:border-primary outline-none font-body text-body-lg py-unit" />
        </Field>

        <Field label="Holder Username" error={errors.username?.message}>
          <input {...register("username")} aria-label="Holder username"
            className="w-full bg-transparent border-b border-outline focus:border-primary outline-none font-body text-body-lg py-unit" />
        </Field>

        <button
          type="submit"
          disabled={isSubmitting}
          className="foil-stamp rounded px-stack-md py-stack-sm font-label text-label-md uppercase text-on-primary hover:-translate-y-px transition-transform disabled:opacity-60"
        >
          {isSubmitting ? "Sealing…" : "Seal & Authorize"}
        </button>
        {done && (
          <p className="font-label text-[11px] tracking-[0.14em] uppercase text-primary font-semibold">Status: Sealed · Folio No. {done}</p>
        )}
      </form>

      <aside className="space-y-stack-md flex flex-col justify-start">
        <section className="border border-outline-variant bg-surface-container-lowest rounded-lg p-stack-md manuscript-glow flex flex-col relative overflow-hidden">
          {/* Ledger line overlay like homepage */}
          <div className="absolute inset-0 bg-repeat-y opacity-5 pointer-events-none ledger-line" />
          
          <h2 className="font-label text-[11px] tracking-[0.14em] uppercase text-secondary mb-unit relative z-10">Commitment Preview</h2>
          <p className="font-caption italic text-on-surface-variant relative z-10">Fig 1.1 — Distillation schematic</p>
          
          <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-0 mt-stack-md relative z-10 select-none">
            {/* Node 1: Leaf */}
            <div className="border border-outline-variant bg-surface-container-lowest rounded-lg p-3 text-center flex flex-col justify-between min-h-[72px]">
              <div className="font-label text-[11px] tracking-[0.1em] uppercase text-secondary truncate">Leaf</div>
              <div className="font-mono text-[12px] text-primary mt-1.5 truncate" title={values.track || "track"}>
                {values.track || "track"}
              </div>
            </div>

            {/* Arrow */}
            <div className="text-outline font-mono px-1.5 text-center">→</div>

            {/* Node 2: Hash fn */}
            <div className="border border-outline-variant bg-surface-container-lowest rounded-lg p-3 text-center flex flex-col justify-between min-h-[72px]">
              <div className="font-label text-[11px] tracking-[0.1em] uppercase text-secondary truncate">Hash fn</div>
              <div className="font-mono text-[12px] text-primary mt-1.5 truncate">poseidon</div>
            </div>

            {/* Arrow */}
            <div className="text-outline font-mono px-1.5 text-center">→</div>

            {/* Node 3: Registry Leaf */}
            <div className="border border-primary bg-gradient-to-br from-[#051a17] to-[#1a2f2b] text-on-primary rounded-lg p-3 text-center flex flex-col justify-between min-h-[72px]">
              <div className="font-label text-[11px] tracking-[0.1em] uppercase text-on-primary-container truncate">
                Registry Leaf
              </div>
              <div className="font-mono text-[12px] text-on-primary mt-1.5 truncate">
                {done ? "sealed ✓" : "pending"}
              </div>
            </div>
          </div>
        </section>

        <TypewriterLog data-testid="mint-log" title="Zelyo · Mint Console" lines={consoleLines} className="manuscript-glow" />
      </aside>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string | undefined; children: ReactNode }) {
  return (
    <label className="block space-y-unit">
      <span className="font-label text-[11px] tracking-[0.14em] uppercase text-secondary">{label}</span>
      {children}
      {error && <span className="block font-caption italic text-error lg:hidden">{error}</span>}
    </label>
  );
}
