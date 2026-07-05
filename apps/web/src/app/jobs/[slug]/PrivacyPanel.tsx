"use client";

import type { Attributes } from "@zelyo/zk-shared";

type Props = {
  disclosed: Record<string, string>;
  boundAddress: string;
  nullifier: string;
};

const ALL_ATTRIBUTE_LABELS: Record<keyof Attributes, string> = {
  learnerName: "Name",
  courseName: "Course",
  grade: "Grade",
  track: "Track",
  issueDate: "Issue Date",
};

export function PrivacyPanel({ disclosed, boundAddress, nullifier }: Props) {
  const disclosedKeys = Object.keys(disclosed);
  const allAttributeKeys = Object.keys(ALL_ATTRIBUTE_LABELS) as (keyof Attributes)[];

  return (
    <article className="manuscript-glow relative rounded-lg border border-outline-variant border-l-2 border-l-primary bg-surface-container-lowest p-stack-md text-on-background">
      <h2 className="font-label text-label-md uppercase text-secondary mb-stack-md">Your Privacy Summary</h2>

      <div className="space-y-stack-md">
        <section>
          <h3 className="font-label text-caption uppercase text-secondary flex items-center mb-stack-sm">
            <span className="mr-stack-sm inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary-fixed text-primary text-xs">&#10003;</span>
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
        </section>

        <hr className="border-outline-variant" />

        <section>
          <h3 className="font-label text-caption uppercase text-secondary flex items-center mb-stack-sm">
            <span className="mr-stack-sm inline-flex h-4 w-4 items-center justify-center rounded-full bg-surface-container text-on-surface-variant text-xs">&#8212;</span>
            Private (never leaves your browser)
          </h3>
          <div className="pl-stack-md space-y-1">
            {allAttributeKeys
              .filter((key) => !disclosedKeys.includes(key))
              .map((key) => (
                <div key={key} className="font-mono text-caption">
                  <span className="text-secondary">{key}:</span>{" "}
                  <span className="font-label text-caption uppercase text-secondary">[HIDDEN]</span>
                </div>
              ))}
          </div>
        </section>
      </div>
    </article>
  );
}
