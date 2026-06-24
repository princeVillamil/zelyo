"use client";

import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  mintFormSchema,
  formValuesToMintInput,
  type MintFormValues,
} from "@/lib/schemas/credential";

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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
      <form onSubmit={handleSubmit(onSubmit)} className="lg:col-span-7 space-y-stack-md ledger-line">
        <p className="font-body text-body-md text-on-surface-variant italic">
          Enter the details of the learner below to begin the cryptographic distillation process.
        </p>

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

        <fieldset className="space-y-stack-sm">
          <legend className="font-label text-label-md uppercase text-secondary">Target Holder</legend>
          <label className="flex items-center gap-stack-sm font-label text-label-md">
            <input type="radio" value="username" {...register("targetMode")} /> By Username
          </label>
          <label className="flex items-center gap-stack-sm font-label text-label-md">
            <input type="radio" value="idCommitment" {...register("targetMode")} /> By id_commitment
          </label>
          {targetMode === "username" ? (
            <Field label="Holder Username" error={errors.username?.message}>
              <input {...register("username")} aria-label="Holder username"
                className="w-full bg-transparent border-b border-outline focus:border-primary outline-none font-body text-body-lg py-unit" />
            </Field>
          ) : (
            <Field label="id_commitment (0x…)" error={errors.idCommitment?.message}>
              <input {...register("idCommitment")} aria-label="id commitment"
                className="w-full bg-transparent border-b border-outline focus:border-primary outline-none typewriter text-body-md py-unit" />
            </Field>
          )}
        </fieldset>

        <button
          type="submit"
          disabled={isSubmitting}
          className="foil-stamp rounded px-stack-md py-stack-sm font-label text-label-md uppercase text-on-primary hover:-translate-y-px transition-transform disabled:opacity-60"
        >
          {isSubmitting ? "Sealing…" : "Seal & Authorize"}
        </button>
        {done && (
          <p className="font-label text-label-md uppercase text-primary">Status: Sealed · Folio No. {done}</p>
        )}
      </form>

      <aside className="lg:col-span-5 space-y-stack-md">
        <section className="border border-outline-variant rounded-lg p-stack-md surface-container-low ledger-line">
          <h2 className="font-label text-label-md uppercase text-secondary">Commitment Preview</h2>
          <p className="font-caption italic text-on-surface-variant">Fig 1.1 — Distillation schematic</p>
          <div className="mt-stack-sm grid grid-cols-3 items-center gap-stack-sm text-center">
            <Box title="DATA" body={values.learnerName || "—"} />
            <Arrow />
            <Box title="HASH-FUNCTION" body="Poseidon" />
          </div>
          <div className="mt-stack-sm grid grid-cols-3 items-center gap-stack-sm text-center">
            <Box title="LEAF" body={values.track ? "Poseidon(idc, attrs)" : "—"} mono />
            <Arrow />
            <Box title="PROOF / ROOT" body="Merkle depth 20" />
          </div>
        </section>

        <section className="border border-outline-variant rounded-lg surface-container-high">
          <h2 className="px-stack-md pt-stack-sm font-label text-label-md uppercase text-secondary">Mint Log</h2>
          <pre data-testid="mint-log" className="typewriter text-caption text-on-surface p-stack-md max-h-64 overflow-auto">
            {log.length === 0 ? "[ awaiting authorization ]" : log.map((l) => (
              `[${new Date(l.ts).toISOString().slice(11, 19)}] ${l.event} … ${l.status}${l.detail ? "  " + l.detail : ""}\n`
            )).join("")}
            <span className="animate-pulse">▍</span>
          </pre>
        </section>
      </aside>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block space-y-unit">
      <span className="font-label text-label-md uppercase text-secondary">{label}</span>
      {children}
      {error && <span className="block font-caption italic text-error">{error}</span>}
    </label>
  );
}

function Box({ title, body, mono }: { title: string; body: string; mono?: boolean }) {
  return (
    <div className="border border-outline-variant rounded p-stack-sm bg-surface-container-lowest">
      <div className="font-label text-caption uppercase text-secondary">{title}</div>
      <div className={`text-caption text-on-surface ${mono ? "typewriter" : "font-body"} truncate`}>{body}</div>
    </div>
  );
}

function Arrow() {
  return <div className="font-label text-on-surface-variant" aria-hidden>→</div>;
}
