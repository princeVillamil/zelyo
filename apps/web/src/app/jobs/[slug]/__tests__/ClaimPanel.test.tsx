import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClaimPanel } from "../ClaimPanel";
import type { GateDetail } from "../../../../server/jobgate.service";

const gate: GateDetail = {
  id: "g1",
  slug: "data-engineering",
  title: "Senior Data Engineer",
  description: "Prove it.",
  requiredPredicate: { attribute: "track", equals: "Data Engineering" },
  rewardType: "CLAIMABLE_BALANCE",
};

afterEach(() => vi.restoreAllMocks());

describe("ClaimPanel", () => {
  it("shows the prove link when no verification params are provided", () => {
    render(<ClaimPanel gate={gate} proveHref="/wallet/prove?gate=data-engineering" initialTxHash={null} initialNullifierHex={null} initialBoundAddress={null} />);
    expect(screen.getByRole("link", { name: /prove with zelyo/i })).toHaveAttribute(
      "href",
      "/wallet/prove?gate=data-engineering",
    );
  });

  it("claims when verification params are present and shows the reward tx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ txHash: "CBTX", rewardType: "CLAIMABLE_BALANCE" }) })),
    );
    render(<ClaimPanel gate={gate} proveHref="/wallet/prove?gate=data-engineering" initialTxHash="tx1" initialNullifierHex="0xnull" initialBoundAddress="GHOLDER" />);
    fireEvent.click(screen.getByRole("button", { name: /claim your reward/i }));
    await waitFor(() => expect(screen.getByText(/CBTX/)).toBeInTheDocument());
  });

  it("surfaces a NULLIFIER_USED rejection as plain copy", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({ error: { code: "PROOF_NOT_ELIGIBLE", message: "The proof does not satisfy this gate." } }) })),
    );
    render(<ClaimPanel gate={gate} proveHref="/wallet/prove?gate=data-engineering" initialTxHash="tx1" initialNullifierHex="0xnull" initialBoundAddress="GHOLDER" />);
    fireEvent.click(screen.getByRole("button", { name: /claim your reward/i }));
    await waitFor(() => expect(screen.getByText(/does not satisfy this gate/i)).toBeInTheDocument());
  });
});
