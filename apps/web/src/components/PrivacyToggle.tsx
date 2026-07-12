"use client";

import { useState } from "react";
import { ALL_ATTRIBUTE_LABELS } from "@/lib/attribute-labels";

type Props = {
  /** Full credential attribute values — only available when the verification links a credential. */
  attributes: Record<string, string> | null;
  disclosed: Record<string, string>;
  boundAddress: string;
  nullifier: string;
};

type Mode = "normal" | "zelyo";

/**
 * Before/After privacy toggle: the same moment viewed through a traditional
 * platform (everything is collected) vs Zelyo (only the disclosed predicate).
 * The "normal" side shows the holder's own credential values to make the
 * contrast concrete — demo-only; production should gate values behind the
 * holder's session (see ROADMAP Demo-Day Feature Shortlist).
 */
export function PrivacyToggle({ attributes, disclosed, boundAddress, nullifier }: Props) {
  const [mode, setMode] = useState<Mode>("zelyo");
  const attributeKeys = Object.keys(ALL_ATTRIBUTE_LABELS) as (keyof typeof ALL_ATTRIBUTE_LABELS)[];
  const disclosedKeys = Object.keys(disclosed);
  const canCompare = attributes !== null;

  return (
    <article className="manuscript-glow relative rounded-lg border border-outline-variant border-l-2 border-l-primary bg-surface-container-lowest p-stack-md text-on-background">
      {canCompare && (
        <div
          role="tablist"
          aria-label="Privacy comparison"
          className="mb-stack-md flex rounded-full border border-outline-variant p-1"
        >
          {(
            [
              ["normal", "A normal platform sees"],
              ["zelyo", "Zelyo reveals"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={mode === value}
              type="button"
              onClick={() => setMode(value)}
              className={`flex-1 rounded-full px-stack-sm py-1 font-label text-caption uppercase transition-colors ${
                mode === value
                  ? "bg-primary text-on-primary"
                  : "text-on-surface-variant hover:text-on-background"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {mode === "normal" && canCompare ? (
        <section>
          <h2 className="font-label text-label-md uppercase text-secondary mb-stack-md">
            What a normal platform sees
          </h2>
          <div className="space-y-1">
            {attributeKeys.map((key) => (
              <div key={key} className="font-mono text-caption">
                <span className="text-secondary">{ALL_ATTRIBUTE_LABELS[key]}:</span>{" "}
                <span className="text-on-background">&ldquo;{attributes[key] ?? "—"}&rdquo;</span>
              </div>
            ))}
          </div>
          <p className="mt-stack-md font-body text-caption text-on-surface-variant">
            Stored in their database, photocopied into forms, shared with partners — whether or
            not the job needs it.
          </p>
        </section>
      ) : (
        <section className="space-y-stack-md">
          <h2 className="font-label text-label-md uppercase text-secondary">
            {canCompare ? "What Zelyo reveals" : "Your Privacy Summary"}
          </h2>
          <div>
            <h3 className="font-label text-caption uppercase text-secondary flex items-center mb-stack-sm">
              <span className="mr-stack-sm inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary-fixed text-primary text-xs">
                &#10003;
              </span>
              Public (on-chain / in proof)
            </h3>
            <div className="pl-stack-md space-y-1">
              {disclosedKeys.map((key) => (
                <div key={key} className="font-mono text-caption">
                  <span className="text-secondary">{key}:</span>{" "}
                  <span className="text-on-background">&ldquo;{disclosed[key]}&rdquo;</span>
                </div>
              ))}
              <div className="font-mono text-caption">
                <span className="text-secondary">bound_address:</span>{" "}
                <span className="break-all text-on-background">{boundAddress}</span>
              </div>
              <div className="font-mono text-caption">
                <span className="text-secondary">nullifier:</span>{" "}
                <span className="break-all text-on-background">{nullifier}</span>
              </div>
            </div>
          </div>

          <hr className="border-outline-variant" />

          <div>
            <h3 className="font-label text-caption uppercase text-secondary flex items-center mb-stack-sm">
              <span className="mr-stack-sm inline-flex h-4 w-4 items-center justify-center rounded-full bg-surface-container text-on-surface-variant text-xs">
                &#8212;
              </span>
              Private (never leaves your browser)
            </h3>
            <div className="pl-stack-md space-y-1">
              {attributeKeys
                .filter((key) => !disclosedKeys.includes(key))
                .map((key) => (
                  <div key={key} className="font-mono text-caption">
                    <span className="text-secondary">{key}:</span>{" "}
                    <span className="font-label text-caption uppercase text-secondary">
                      [HIDDEN]
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </section>
      )}
    </article>
  );
}
