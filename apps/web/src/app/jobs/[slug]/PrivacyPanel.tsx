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
    <div className="border border-outline-variant rounded-lg p-stack-md surface-container-lowest">
      <h2 className="font-label text-label-md uppercase text-secondary mb-stack-md">Your Privacy Summary</h2>

      <div className="space-y-stack-md">
        <section>
          <h3 className="font-label text-caption uppercase text-primary flex items-center gap-stack-xs mb-stack-sm">
            <span className="inline-block w-4 h-4 rounded-full bg-primary text-on-primary text-center leading-4 text-xs">&#10003;</span>
            PUBLIC (on-chain / in proof)
          </h3>
          <div className="pl-stack-md space-y-1">
            {disclosedKeys.map((key) => (
              <div key={key} className="font-mono text-caption">
                <span className="text-secondary">{key}:</span>{" "}
                <span className="text-primary">&ldquo;{disclosed[key]}&rdquo;</span>
              </div>
            ))}
            <div className="font-mono text-caption">
              <span className="text-secondary">bound_address:</span>{" "}
              <span className="text-primary truncate max-w-[200px] inline-block align-bottom">{boundAddress}</span>
            </div>
            <div className="font-mono text-caption">
              <span className="text-secondary">nullifier:</span>{" "}
              <span className="text-primary truncate max-w-[200px] inline-block align-bottom">{nullifier}</span>
            </div>
          </div>
        </section>

        <hr className="border-outline-variant" />

        <section>
          <h3 className="font-label text-caption uppercase text-on-surface-variant flex items-center gap-stack-xs mb-stack-sm">
            <span className="inline-block w-4 h-4 rounded-full bg-on-surface-variant text-surface-container-lowest text-center leading-4 text-xs">&#128274;</span>
            PRIVATE (never leaves your browser)
          </h3>
          <div className="pl-stack-md space-y-1">
            {allAttributeKeys
              .filter((key) => !disclosedKeys.includes(key))
              .map((key) => (
                <div key={key} className="font-mono text-caption">
                  <span className="text-secondary">{key}:</span>{" "}
                  <span className="font-label text-caption uppercase text-on-surface-variant">[HIDDEN]</span>
                </div>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}
