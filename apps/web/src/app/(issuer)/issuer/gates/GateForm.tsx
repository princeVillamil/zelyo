"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const predicateSchema = z.object({
  attribute: z.string().min(1, "Attribute is required"),
  equals: z.string().min(1, "Value is required"),
});

const assetSchema = z
  .object({
    code: z.string().min(1, "Asset code is required"),
    // Empty issuer = native asset (e.g. native XLM). The API/service already treat
    // an empty issuer as native; the form only needed to stop requiring one.
    issuer: z.string().optional(),
    amount: z.string().min(1, "Amount is required"),
  })
  .refine(
    (data) =>
      !(data.code.toUpperCase() === "XLM" && data.issuer && data.issuer.trim().length > 0),
    {
      message: "XLM is native and cannot have an issuer. Leave issuer empty for native XLM.",
      path: ["issuer"],
    },
  );

const rewardConfigSchema = z.object({
  asset: assetSchema,
}).partial();

// The current circuit only proves/discloses `track`. Restrict gate predicates to
// `track` so admins cannot create gates on attributes that can never be satisfied.
const ATTRIBUTES = ["track"] as const;

const gateFormSchema = z.object({
  slug: z.string()
    .min(1, "Slug is required")
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens"),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().min(1, "Description is required").max(2000),
  predicates: z.array(predicateSchema).min(1, "At least one predicate is required"),
  rewardType: z.enum(["CLAIMABLE_BALANCE", "REGULATED_ASSET", "FLAG"]),
  rewardConfig: rewardConfigSchema,
  expiresAt: z.string().optional().nullable(),
}).refine(
  (data) => {
    if (data.rewardType !== "REGULATED_ASSET") return true;
    const asset = data.rewardConfig?.asset;
    if (!asset || asset.code.toUpperCase() === "XLM") {
      return false;
    }
    return !!asset.issuer?.trim();
  },
  {
    message: "Regulated assets require a custom asset code (not XLM) and an issuer.",
    path: ["rewardConfig", "asset", "code"],
  },
);

type GateFormValues = z.infer<typeof gateFormSchema>;

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

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
      slug: "",
      predicates: [{ attribute: "track", equals: "" }],
      rewardType: "CLAIMABLE_BALANCE",
      rewardConfig: {
        asset: { code: "XLM", issuer: "", amount: "" },
      },
      expiresAt: null,
    },
  });

  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const predicates = watch("predicates");
  const rewardType = watch("rewardType");
  const title = watch("title");
  const slug = watch("slug");

  useEffect(() => {
    if (title) {
      setValue("slug", slugify(title), { shouldValidate: true });
    }
  }, [title, setValue]);

  useEffect(() => {
    if (rewardType === "FLAG") {
      setValue("rewardConfig", {});
    } else if (rewardType === "REGULATED_ASSET") {
      setValue("rewardConfig", { asset: { code: "", issuer: "", amount: "" } });
    } else if (rewardType === "CLAIMABLE_BALANCE") {
      setValue("rewardConfig", { asset: { code: "XLM", issuer: "", amount: "" } });
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
    <div className="w-full">
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-2 gap-gutter w-full">
        {/* Left Column: Gate Information */}
        <div className="space-y-stack-md">
          <Field label="Title" error={errors.title?.message}>
            <input
              {...register("title")}
              placeholder="Data Engineering Gate"
              aria-label="Gate title"
              className="w-full bg-transparent border-b border-outline focus:border-primary outline-none font-body text-body-lg py-unit"
            />
          </Field>

          {slug && (
            <p className="font-mono text-caption text-on-surface-variant">
              URL slug: /jobs/{slug}
            </p>
          )}

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
            <legend className="font-label text-[11px] tracking-[0.14em] uppercase text-secondary">Required Predicates</legend>
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
        </div>

        {/* Right Column: Reward Configuration */}
        <div className="space-y-stack-md border-t lg:border-t-0 lg:border-l border-outline-variant pt-stack-md lg:pt-0 lg:pl-gutter flex flex-col justify-between">
          <div className="space-y-stack-md">
            <fieldset className="space-y-stack-sm">
              <legend className="font-label text-[11px] tracking-[0.14em] uppercase text-secondary">Reward Type</legend>
              <label className="flex items-center gap-stack-sm font-label text-label-md">
                <input type="radio" value="CLAIMABLE_BALANCE" {...register("rewardType")} />
                Claimable Balance
              </label>
              <label className="flex items-center gap-stack-sm font-label text-label-md">
                <input type="radio" value="REGULATED_ASSET" {...register("rewardType")} />
                Regulated Asset (SEP-8)
              </label>
              <label className="flex items-center gap-stack-sm font-label text-label-md">
                <input type="radio" value="FLAG" {...register("rewardType")} />
                Verified Flag (on-chain)
              </label>
            </fieldset>

            {(rewardType === "CLAIMABLE_BALANCE" || rewardType === "REGULATED_ASSET") && (
              <div key="asset-config" className="space-y-stack-sm pl-stack-md border-l-2 border-outline-variant">
                <p className="font-label text-[11px] tracking-[0.14em] uppercase text-secondary">Asset Configuration</p>
                {rewardType === "REGULATED_ASSET" && (
                  <p className="font-caption italic text-on-surface-variant">
                    For SEP-8 regulated assets, the issuer must be this Zelyo issuer and the asset must have
                    AUTHORIZATION_REQUIRED + AUTHORIZATION_REVOCABLE flags on Stellar.
                  </p>
                )}
                <div className="grid grid-cols-3 gap-stack-sm">
                  <Field label="Code" error={errors.rewardConfig?.asset?.code?.message}>
                    <input
                      {...register("rewardConfig.asset.code")}
                      placeholder={rewardType === "REGULATED_ASSET" ? "ZELYO" : "XLM"}
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
                {rewardType !== "REGULATED_ASSET" && (
                  <span className="block font-caption italic text-on-surface-variant">
                    Leave empty for native XLM
                  </span>
                )}
              </div>
            )}

            <Field label="Expiration Date (optional)" error={errors.expiresAt?.message}>
              <input
                type="date"
                {...register("expiresAt")}
                aria-label="Gate expiration date"
                className="w-full bg-transparent border-b border-outline focus:border-primary outline-none font-mono text-body-lg py-unit"
              />
              <span className="font-caption italic text-on-surface-variant">Leave empty for no expiration</span>
            </Field>
          </div>

          <div className="pt-stack-lg border-t border-outline-variant mt-stack-lg">
            <button
              type="submit"
              disabled={isSubmitting}
              className="foil-stamp w-full rounded px-stack-md py-stack-sm font-label text-label-md uppercase text-on-primary hover:-translate-y-px transition-transform disabled:opacity-60"
            >
              {isSubmitting ? "Creating…" : status === "success" ? "Created!" : "Create Gate"}
            </button>

            {status === "error" && errorMessage && (
              <p className="font-body text-body-md text-error mt-stack-sm">{errorMessage}</p>
            )}
            {done && (
              <p className="font-label text-label-md uppercase text-primary mt-stack-sm">
                Gate created: <a href={`/jobs/${done}`} className="underline">/jobs/{done}</a>
              </p>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string | undefined; children: ReactNode }) {
  return (
    <label className="block space-y-unit">
      <span className="font-label text-[11px] tracking-[0.14em] uppercase text-secondary">{label}</span>
      {children}
      {error && <span className="block font-caption italic text-error">{error}</span>}
    </label>
  );
}
