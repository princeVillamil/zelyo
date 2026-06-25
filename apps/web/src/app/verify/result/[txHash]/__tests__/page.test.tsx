import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { getVerificationByTxHash, notFound } = vi.hoisted(() => ({
  getVerificationByTxHash: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("../../../../../server/verification-read.service", () => ({ getVerificationByTxHash }));
vi.mock("next/navigation", () => ({ notFound }));

import VerifyResultPage from "../page";

describe("VerifyResultPage", () => {
  it("calls notFound when there is no verification row", async () => {
    getVerificationByTxHash.mockResolvedValue(null);
    await expect(
      VerifyResultPage({ params: Promise.resolve({ txHash: "missing" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("renders the reveal panel for an existing verification", async () => {
    getVerificationByTxHash.mockResolvedValue({
      txHash: "tx1",
      result: "VERIFIED",
      nullifierHex: "0xnull",
      boundAddress: "GABC",
      disclosed: { track: "Data Engineering" },
      explorerUrl: "https://explorer.test/tx/tx1",
      createdAt: new Date("2026-06-23T00:00:00Z"),
      jobGateSlug: null,
    });
    const ui = await VerifyResultPage({ params: Promise.resolve({ txHash: "tx1" }) });
    render(ui);
    expect(screen.getByText(/nothing personal is recorded on-chain/i)).toBeInTheDocument();
  });
});
