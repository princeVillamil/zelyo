"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const predicateSchema = z.object({
  attribute: z.string().min(1, "Attribute is required"),
  equals: z.string().min(1, "Value is required"),
});

const assetSchema = z.object({
  code: z.string().min(1, "Asset code is required"),
  issuer: z.string().min(1, "Asset issuer is required"),
  amount: z.string().min(1, "Amount is required"),
});

const rewardConfigSchema = z.object({
  asset: assetSchema,
}).partial();

const ATTRIBUTES = ["track", "grade", "learnerName", "courseName", "issueDate"] as const;

const gateFormSchema = z.object({
  slug: z.string()
    .min(1, "Slug is required")
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens"),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().min(1, "Description is required").max(2000),
  predicates: z.array(predicateSchema).min(1, "At least one predicate is required"),
  rewardType: z.enum(["CLAIMABLE_BALANCE", "FLAG"]),
  rewardConfig: rewardConfigSchema,
  expiresAt: z.string().optional().nullable(),
});

type GateFormValues = z.infer<typeof gateFormSchema>;

export function GateForm() {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<GateFormValues>({
    resolver: zodResolver(gateFormSchema),
    defaultValues: {
      predicates: [{ attribute: "track", equals: "" }],
      rewardType: "CLAIMABLE_BALANCE",
      rewardConfig: {},
      expiresAt: null,
    },
  });

  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const predicates = watch("predicates");
  const rewardType = watch("rewardType");

  useEffect(() => {
    if (rewardType === "FLAG") {
      setValue("rewardConfig", {});
    }
  }, [rewardType, setValue]);

  function addPredicate() {
    setValue("predicates", [...predicates, { attribute: "track", equals: "" }]);
  }

  function removePredicate(index: number) {
    if (predicates.length > 1) {
      setValue("predicates", predicates.filter((_, i) => i !== index));
    }
  }

  async function onSubmit(values: GateFormValues) {
    setStatus("idle");
    setErrorMessage(null);

    try {
      const payload = {
        slug: values.slug,
        title: values.title,
        description: values.description,
        requiredPredicates: values.predicates,
        rewardType: values.rewardType,
        rewardConfig: values.rewardConfig,
        expiresAt: values.expiresAt,
      };

      const res = await fetch("/api/issuer/gates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        setStatus("error");
        setErrorMessage(body.error?.message ?? "Gate creation failed");
        return;
      }

      const gate = await res.json();
      setStatus("success");
      setDone(gate.slug);
      setTimeout(() => {
        setDone(null);
        setStatus("idle");
      }, 3000);
    } catch (err) {
      console.error("Gate creation error:", err);
      setStatus("error");
      setErrorMessage("An unexpected error occurred");
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
      <form onSubmit={handleSubmit(onSubmit)} className="lg:col-span-7 space-y-stack-md ledger-line">
        <p className="font-body text-body-md text-on-surface-variant italic">
          Define a new reward gate for the public board. Holders who satisfy the predicates can claim the reward.
        </p>

        <Field label="Slug" error={errors.slug?.message}>
          <input
            {...register("slug")}
            placeholder="data-engineering-2"
            aria-label="Gate slug"
            className="w-full bg-transparent border-b border-outline focus:border-primary outline-none font-mono text-body-lg py-unit"
          />
        </Field>

        <Field label="Title" error={errors.title?.message}>
          <input
            {...register("title")}
            placeholder="Data Engineering Gate"
            aria-label="Gate title"
            className="w-full bg-transparent border-b border-outline focus:border-primary outline-none font-body text-body-lg py-unit"
          />
        </Field>

        <Field label="Description" error={errors.description?.message}>
          <textarea
            {...register("description")}
            placeholder="Prove your Data Engineering certification to unlock this reward..."
            aria-label="Gate description"
            rows={3}
            className="w-full bg-transparent border-b border-outline focus:border-primary outline-none font-body text-body-lg py-unit resize-y"
          />
        </Field>

        <fieldset className="space-y-stack-sm">
          <legend className="font-label text-label-md uppercase text-secondary">Required Predicates</legend>
          {errors.predicates?.message && (
            <p className="font-caption italic text-error">{errors.predicates.message}</p>
          )}
          {predicates.map((_, index) => (
            <div key={index} className="flex gap-stack-sm items-end">
              <Field label="Attribute" error={errors.predicates?.[index]?.attribute?.message}>
                <select
                  {...register(`predicates.${index}.attribute`)}
                  aria-label="Predicate attribute"
                  className="w-full bg-surface-container-lowest border-b border-outline focus:border-primary outline-none font-body text-body-lg py-unit"
                >
                  {ATTRIBUTES.map((attr) => (
                    <option key={attr} value={attr}>{attr}</option>
                  ))}
                </select>
              </Field>
              <Field label="Equals" error={errors.predicates?.[index]?.equals?.message}>
                <input
                  {...register(`predicates.${index}.equals`)}
                  placeholder="Data Engineering"
                  aria-label="Predicate value"
                  className="w-full bg-transparent border-b border-outline focus:border-primary outline-none font-body text-body-lg py-unit"
                />
              </Field>
              {predicates.length > 1 && (
                <button
                  type="button"
                  onClick={() => removePredicate(index)}
                  className="font-label text-label-md uppercase text-error pb-unit"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addPredicate}
            className="font-label text-label-md uppercase text-secondary hover:text-primary transition-colors"
          >
            + Add Predicate (AND)
          </button>
        </fieldset>

        <fieldset className="space-y-stack-sm">
          <legend className="font-label text-label-md uppercase text-secondary">Reward Type</legend>
          <label className="flex items-center gap-stack-sm font-label text-label-md">
            <input type="radio" value="CLAIMABLE_BALANCE" {...register("rewardType")} />
            Claimable Balance (XLM)
          </label>
          <label className="flex items-center gap-stack-sm font-label text-label-md">
            <input type="radio" value="FLAG" {...register("rewardType")} />
            Verified Flag (on-chain)
          </label>
        </fieldset>

        {rewardType === "CLAIMABLE_BALANCE" && (
          <div key="asset-config" className="space-y-stack-sm pl-stack-md border-l-2 border-outline-variant">
            <p className="font-label text-label-md uppercase text-secondary">Asset Configuration</p>
            <div className="grid grid-cols-3 gap-stack-sm">
              <Field label="Code" error={errors.rewardConfig?.asset?.code?.message}>
                <input
                  {...register("rewardConfig.asset.code")}
                  placeholder="XLM"
                  aria-label="Asset code"
                  className="w-full bg-transparent border-b border-outline focus:border-primary outline-none font-mono text-body-lg py-unit"
                />
              </Field>
              <Field label="Issuer" error={errors.rewardConfig?.asset?.issuer?.message}>
                <input
                  {...register("rewardConfig.asset.issuer")}
                  placeholder="G..."
                  aria-label="Asset issuer"
                  className="w-full bg-transparent border-b border-outline focus:border-primary outline-none font-mono text-body-lg py-unit"
                />
              </Field>
              <Field label="Amount" error={errors.rewardConfig?.asset?.amount?.message}>
                <input
                  {...register("rewardConfig.asset.amount")}
                  placeholder="5"
                  aria-label="Amount"
                  className="w-full bg-transparent border-b border-outline focus:border-primary outline-none font-mono text-body-lg py-unit"
                />
              </Field>
            </div>
          </div>
        )}

        <Field label="Expiration Date (optional)" error={errors.expiresAt?.message}>
          <input
            type="date"
            {...register("expiresAt")}
            aria-label="Gate expiration date"
            className="w-full bg-transparent border-b border-outline focus:border-primary outline-none font-mono text-body-lg py-unit"
          />
          <span className="font-caption italic text-on-surface-variant">Leave empty for no expiration; time defaults to end of day</span>
        </Field>

        <button
          type="submit"
          disabled={false}
          className="foil-stamp rounded px-stack-md py-stack-sm font-label text-label-md uppercase text-on-primary hover:-translate-y-px transition-transform disabled:opacity-60"
        >
          {isSubmitting ? "Creating…" : status === "success" ? "Created!" : "Create Gate"}
        </button>

        {status === "error" && errorMessage && (
          <p className="font-body text-body-md text-error mt-stack-sm">{errorMessage}</p>
        )}
        {done && (
          <p className="font-label text-label-md uppercase text-primary">
            Gate created: <a href={`/jobs/${done}`} className="underline">/jobs/{done}</a>
          </p>
        )}
      </form>

      <aside className="lg:col-span-5 space-y-stack-md">
        <section className="border border-outline-variant rounded-lg p-stack-md surface-container-low ledger-line">
          <h2 className="font-label text-label-md uppercase text-secondary">Gate Preview</h2>
          <p className="font-caption italic text-on-surface-variant">Fig 1.1 — Gate schematic</p>
          <div className="mt-stack-sm space-y-2">
            {predicates.map((pred, i) => (
              <div key={i} className="flex items-center gap-stack-sm font-mono text-caption">
                <span className="text-secondary">IF</span>
                <span className="text-primary">{pred.attribute || "?"}</span>
                <span className="text-secondary">==</span>
                <span className="text-primary">&ldquo;{pred.equals || "?"}&rdquo;</span>
                {i < predicates.length - 1 && <span className="text-secondary ml-stack-sm">AND</span>}
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string | undefined; children: ReactNode }) {
  return (
    <label className="block space-y-unit">
      <span className="font-label text-label-md uppercase text-secondary">{label}</span>
      {children}
      {error && <span className="block font-caption italic text-error">{error}</span>}
    </label>
  );
}
