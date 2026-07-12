import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClaimPanel } from "../ClaimPanel";
import type { GateDetail } from "../../../../server/jobgate.service";

const gate: GateDetail = {
  id: "g1",
  slug: "data-engineering",
  title: "Senior Data Engineer",
  description: "Prove it.",
  requiredPredicates: [{ attribute: "track", equals: "Data Engineering" }],
  rewardType: "CLAIMABLE_BALANCE",
  rewardConfig: { asset: { code: "XLM", issuer: "", amount: "10" } },
  expiresAt: null,
};

afterEach(() => vi.restoreAllMocks());

const provenProps = {
  gate,
  proveHref: "/wallet/prove?gate=data-engineering",
  initialTxHash: "tx1",
  initialNullifierHex: "0xnull",
  initialBoundAddress: "GHOLDER",
};

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

  it("offers whitelisted receive assets and posts the selection", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ txHash: "PATHTX", rewardType: "CLAIMABLE_BALANCE" }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ClaimPanel {...provenProps} receiveChoices={[{ code: "USDC", issuer: "GUSDC" }]} />,
    );

    fireEvent.click(screen.getByRole("radio", { name: /usdc \(via sdex\)/i }));
    fireEvent.click(screen.getByRole("button", { name: /claim your reward/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({
      receiveAsset: { code: "USDC", issuer: "GUSDC" },
    });
  });

  it("omits receiveAsset when XLM (direct) is selected", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ txHash: "PAYTX", rewardType: "CLAIMABLE_BALANCE" }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ClaimPanel {...provenProps} receiveChoices={[{ code: "USDC", issuer: "GUSDC" }]} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /claim your reward/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).not.toHaveProperty("receiveAsset");
  });

  it("renders no asset-choice fieldset when no choices are provided", () => {
    render(<ClaimPanel {...provenProps} />);
    expect(screen.queryByText(/receive reward as/i)).not.toBeInTheDocument();
  });

  it("shows the rejected panel with the original reward link on ALREADY_CLAIMED", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({
          error: {
            code: "ALREADY_CLAIMED",
            message: "This proof already claimed its reward.",
            details: { explorerUrl: "https://explorer.test/tx/OLDTX" },
          },
        }),
      })),
    );
    render(<ClaimPanel {...provenProps} />);

    fireEvent.click(screen.getByRole("button", { name: /claim your reward/i }));

    expect(await screen.findByText(/claim rejected — already claimed/i)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /original reward on the explorer/i });
    expect(link).toHaveAttribute("href", "https://explorer.test/tx/OLDTX");
  });
});
