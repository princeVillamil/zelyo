import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExplorerRevealPanel } from "../ExplorerRevealPanel";
import type { VerificationView } from "../../server/verification-read.service";

const base: VerificationView = {
  txHash: "tx1",
  result: "VERIFIED",
  nullifierHex: "0xdeadbeef",
  boundAddress: "0xcafebabe",
  boundStellarAddress: "GASTINUANRYSHXSWZNAGDKYNISWSP4ZCDC534OVIA7IE272OIWSSQZGJ",
  disclosed: { track: "Data Engineering" },
  disclosedRaw: { track: "Data Engineering" },
  explorerUrl: "https://explorer.test/tx/tx1",
  createdAt: new Date("2026-06-23T00:00:00Z"),
  jobGateSlug: null,
  credentialId: null,
};

describe("ExplorerRevealPanel", () => {
  it("shows the verified state with explorer link and nothing-personal copy", () => {
    // Pass disclosed attributes the panel must NEVER render as values.
    render(
      <ExplorerRevealPanel
        view={{ ...base, disclosed: { track: "Data Engineering", grade: "A+", name: "Ada Lovelace" } }}
      />,
    );
    expect(screen.getByText(/nothing personal is recorded on-chain/i)).toBeInTheDocument();
    expect(screen.getByText("0xdeadbeef")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /view on the stellar explorer/i });
    expect(link).toHaveAttribute("href", "https://explorer.test/tx/tx1");
    // The panel renders only nullifier/address/tx — never a disclosed attribute value.
    expect(screen.queryByText("A+")).not.toBeInTheDocument();
    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
  });

  it("shows the Sybil-rejection state for NULLIFIER_USED", () => {
    render(<ExplorerRevealPanel view={{ ...base, result: "NULLIFIER_USED" }} />);
    expect(screen.getByText(/already been used/i)).toBeInTheDocument();
    expect(screen.getAllByText(/sybil block/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /view on the stellar explorer/i })).not.toBeInTheDocument();
  });
});
