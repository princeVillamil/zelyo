import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProofReceipt } from "../ProofReceipt";
import type { VerificationView } from "../../server/verification-read.service";

const base: VerificationView = {
  txHash: "tx1",
  result: "VERIFIED",
  nullifierHex: "0xdeadbeef",
  rootHex: "0xroot",
  rootAnchorTxHash: null,
  boundAddress: "0xcafebabe",
  boundStellarAddress: "GASTINUANRYSHXSWZNAGDKYNISWSP4ZCDC534OVIA7IE272OIWSSQZGJ",
  disclosed: { track: "Data Engineering" },
  disclosedRaw: { track: "Data Engineering" },
  explorerUrl: "https://explorer.test/tx/tx1",
  createdAt: new Date("2026-06-23T00:00:00Z"),
  jobGateSlug: null,
  jobGateTitle: null,
  credentialId: null,
};

describe("ProofReceipt", () => {
  it("shows the fact proven, anchors, and never-revealed labels — never hidden values", () => {
    // Pass undisclosed attribute values in `disclosed`; the receipt must NEVER render them.
    render(
      <ProofReceipt
        view={{ ...base, disclosed: { track: "Data Engineering", grade: "A+", name: "Ada Lovelace" } }}
      />,
    );
    expect(screen.getByText(/fact proven/i)).toBeInTheDocument();
    expect(screen.getByText(/track ==/i)).toBeInTheDocument();
    expect(screen.getByText("0xdeadbeef")).toBeInTheDocument();
    expect(screen.getByText("0xroot")).toBeInTheDocument();
    // Hidden attributes appear as labels only.
    expect(screen.getByText(/grade · \[never revealed\]/i)).toBeInTheDocument();
    expect(screen.getByText(/name · \[never revealed\]/i)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /view on the stellar explorer/i });
    expect(link).toHaveAttribute("href", "https://explorer.test/tx/tx1");
    // Undisclosed values never reach the page.
    expect(screen.queryByText("A+")).not.toBeInTheDocument();
    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
  });

  it("headlines the gate and links the root anchor when present", () => {
    render(
      <ProofReceipt
        view={{
          ...base,
          jobGateSlug: "senior-data-eng",
          jobGateTitle: "Senior Data Engineer",
          rootAnchorTxHash: "roottx",
        }}
      />,
    );
    expect(screen.getByText(/proved eligibility for/i)).toBeInTheDocument();
    expect(screen.getByText(/senior data engineer/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /root anchored on-chain/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to the gate/i })).toHaveAttribute(
      "href",
      "/jobs/senior-data-eng",
    );
  });

  it("shows the Sybil-rejection state for NULLIFIER_USED", () => {
    render(<ProofReceipt view={{ ...base, result: "NULLIFIER_USED" }} />);
    expect(screen.getByText(/already been used/i)).toBeInTheDocument();
    expect(screen.getAllByText(/sybil block/i).length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("link", { name: /view on the stellar explorer/i }),
    ).not.toBeInTheDocument();
  });
});
