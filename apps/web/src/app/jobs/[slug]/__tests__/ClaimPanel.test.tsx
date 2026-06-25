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

function setSearch(qs: string) {
  Object.defineProperty(window, "location", {
    writable: true,
    value: new URL(`http://localhost/jobs/data-engineering${qs}`),
  });
}

afterEach(() => vi.restoreAllMocks());

describe("ClaimPanel", () => {
  it("shows the prove link when no verification is in the URL", () => {
    setSearch("");
    render(<ClaimPanel gate={gate} proveHref="/wallet/prove?gate=data-engineering" />);
    expect(screen.getByRole("link", { name: /prove with zelyo/i })).toHaveAttribute(
      "href",
      "/wallet/prove?gate=data-engineering",
    );
  });

  it("claims when verification params are present and shows the reward tx", async () => {
    setSearch("?txHash=tx1&nullifier=0xnull&address=GHOLDER");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ txHash: "CBTX", rewardType: "CLAIMABLE_BALANCE" }) })),
    );
    render(<ClaimPanel gate={gate} proveHref="/wallet/prove?gate=data-engineering" />);
    fireEvent.click(screen.getByRole("button", { name: /claim your reward/i }));
    await waitFor(() => expect(screen.getByText(/CBTX/)).toBeInTheDocument());
  });

  it("surfaces a NULLIFIER_USED rejection as plain copy", async () => {
    setSearch("?txHash=tx1&nullifier=0xnull&address=GHOLDER");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({ error: { code: "PROOF_NOT_ELIGIBLE", message: "The proof does not satisfy this gate." } }) })),
    );
    render(<ClaimPanel gate={gate} proveHref="/wallet/prove?gate=data-engineering" />);
    fireEvent.click(screen.getByRole("button", { name: /claim your reward/i }));
    await waitFor(() => expect(screen.getByText(/does not satisfy this gate/i)).toBeInTheDocument());
  });
});
