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
    <div className="foil-stamp relative rounded-lg p-stack-md text-primary-fixed">
      <h2 className="font-label text-label-md uppercase text-primary-fixed-dim mb-stack-md">Your Privacy Summary</h2>

      <div className="space-y-stack-md">
        <section>
          <h3 className="font-label text-caption uppercase text-on-primary flex items-center mb-stack-sm">
            <span className="mr-stack-sm inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary-fixed text-primary text-xs">&#10003;</span>
            PUBLIC (on-chain / in proof)
          </h3>
          <div className="pl-stack-md space-y-1">
            {disclosedKeys.map((key) => (
              <div key={key} className="font-mono text-caption">
                <span className="text-primary-fixed-dim">{key}:</span>{" "}
                <span className="text-on-primary">&ldquo;{disclosed[key]}&rdquo;</span>
              </div>
            ))}
            <div className="font-mono text-caption">
              <span className="text-primary-fixed-dim">bound_address:</span>{" "}
              <span className="text-on-primary truncate max-w-[200px] inline-block align-bottom">{boundAddress}</span>
            </div>
            <div className="font-mono text-caption">
              <span className="text-primary-fixed-dim">nullifier:</span>{" "}
              <span className="text-on-primary truncate max-w-[200px] inline-block align-bottom">{nullifier}</span>
            </div>
          </div>
        </section>

        <hr className="border-primary-fixed-dim/30" />

        <section>
          <h3 className="font-label text-caption uppercase text-primary-fixed-dim flex items-center mb-stack-sm">
            <span className="mr-stack-sm inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/10 text-primary-fixed-dim text-xs">&#8212;</span>
            PRIVATE (never leaves your browser)
          </h3>
          <div className="pl-stack-md space-y-1">
            {allAttributeKeys
              .filter((key) => !disclosedKeys.includes(key))
              .map((key) => (
                <div key={key} className="font-mono text-caption">
                  <span className="text-primary-fixed-dim">{key}:</span>{" "}
                  <span className="font-label text-caption uppercase text-primary-fixed-dim">[HIDDEN]</span>
                </div>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}
