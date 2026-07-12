import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FieldHex } from "@zelyo/zk-shared";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/holder-key.client", () => ({ loadHolderSecret: vi.fn() }));
vi.mock("@/lib/prover.client", () => ({
  proveCredential: vi.fn(),
  ProverError: class ProverError extends Error { constructor(public code: string) { super(code); } },
}));

import { ProvePanel } from "./ProvePanel";
import { loadHolderSecret } from "@/lib/holder-key.client";
import { proveCredential } from "@/lib/prover.client";

const credential = {
  id: "c1",
  attributes: { track: "Data Engineering", grade: "A", issueDate: "2026-01-01", courseName: "DS", learnerName: "Ada" },
  leafIndex: 3,
  merklePath: { siblings: [("0x" + "00".repeat(32)) as FieldHex], pathIndices: [0] },
  root: ("0x" + "ab".repeat(32)) as FieldHex,
};
const ADDR = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
const WALLETS = [
  { id: "w1", type: "STELLAR_ACCOUNT" as const, address: ADDR, isDefault: true },
];

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});

describe("ProvePanel", () => {
  it("defaults to disclosing only track; no other disclosure checkboxes are rendered", () => {
    render(<ProvePanel credential={credential} linkedWallets={WALLETS} />);
    expect((screen.getByLabelText(/track/i) as HTMLInputElement).checked).toBe(true);
    // The circuit currently only supports disclosing `track`.
    expect(screen.queryByLabelText(/learner name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/grade/i)).not.toBeInTheDocument();
  });

  it("shows the linked wallet address and hides the manual address input", () => {
    render(<ProvePanel credential={credential} linkedWallets={WALLETS} />);
    expect(screen.getByText(ADDR)).toBeInTheDocument();
    expect(screen.queryByLabelText(/stellar address/i)).not.toBeInTheDocument();
  });

  it("prompts to link a wallet when no wallets are linked", () => {
    render(<ProvePanel credential={credential} linkedWallets={[]} />);
    expect(screen.getByText(/no wallet is linked/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /link a wallet/i })).toHaveAttribute("href", "/wallet/keys");
  });

  it("auto-selects the default wallet and uses it for proving", async () => {
    vi.mocked(loadHolderSecret).mockResolvedValue(("0x" + "11".repeat(32)) as FieldHex);
    vi.mocked(proveCredential).mockResolvedValue({
      proof: new Uint8Array([7, 8, 9]),
      publicInputs: {
        root: credential.root, scope: ("0x" + "cd".repeat(32)) as FieldHex,
        boundAddress: ("0x" + "ef".repeat(32)) as FieldHex,
        nullifier: ("0x" + "12".repeat(32)) as FieldHex, disclosed: { value: ("0x" + "34".repeat(32)) as FieldHex, raw: { track: "Data Engineering" } },
      },
    });
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true, result: "VERIFIED", txHash: "TX123" }), { status: 200 }),
    );
    const user = userEvent.setup();
    render(<ProvePanel credential={credential} linkedWallets={WALLETS} />);
    await user.type(screen.getByLabelText(/passphrase/i), "pass");
    await user.click(screen.getByRole("button", { name: /generate zk-proof/i }));

    await waitFor(() => expect(proveCredential).toHaveBeenCalledOnce());
    expect(proveCredential).toHaveBeenCalledWith(expect.objectContaining({ boundStellarAddress: ADDR }));
    const body = JSON.parse(((vi.mocked(global.fetch).mock.calls[0]![1] as RequestInit | undefined)?.body as string) ?? '{}');
    expect(body.boundStellarAddress).toBe(ADDR);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/verify/result/TX123"));
  });

  it("allows switching between multiple linked wallets", async () => {
    const wallets = [
      { id: "w1", type: "STELLAR_ACCOUNT" as const, address: ADDR, isDefault: false },
      { id: "w2", type: "PASSKEY_SMART_WALLET" as const, address: "CDEF123", isDefault: true },
    ];
    vi.mocked(loadHolderSecret).mockResolvedValue(("0x" + "11".repeat(32)) as FieldHex);
    vi.mocked(proveCredential).mockResolvedValue({
      proof: new Uint8Array([7, 8, 9]),
      publicInputs: {
        root: credential.root, scope: ("0x" + "cd".repeat(32)) as FieldHex,
        boundAddress: ("0x" + "ef".repeat(32)) as FieldHex,
        nullifier: ("0x" + "12".repeat(32)) as FieldHex, disclosed: { value: ("0x" + "34".repeat(32)) as FieldHex, raw: { track: "Data Engineering" } },
      },
    });
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true, result: "VERIFIED", txHash: "TX123" }), { status: 200 }),
    );
    const user = userEvent.setup();
    render(<ProvePanel credential={credential} linkedWallets={wallets} />);

    // Default wallet is shown.
    expect(screen.getByText("CDEF123")).toBeInTheDocument();

    // Switch to the other wallet.
    await user.click(screen.getByRole("button", { name: /GBRPYH…C7OX2H/i }));
    await user.type(screen.getByLabelText(/passphrase/i), "pass");
    await user.click(screen.getByRole("button", { name: /generate zk-proof/i }));

    await waitFor(() => expect(proveCredential).toHaveBeenCalledOnce());
    expect(proveCredential).toHaveBeenCalledWith(expect.objectContaining({ boundStellarAddress: ADDR }));
  });

  it("shows the Sybil rejection inline when result is NULLIFIER_USED", async () => {
    vi.mocked(loadHolderSecret).mockResolvedValue(("0x" + "11".repeat(32)) as FieldHex);
    vi.mocked(proveCredential).mockResolvedValue({
      proof: new Uint8Array(),
      publicInputs: { root: credential.root, scope: "0x0" as FieldHex, boundAddress: "0x0" as FieldHex, nullifier: "0x0" as FieldHex, disclosed: { value: "0x0" as FieldHex, raw: { track: "Data Engineering" } } },
    });
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: false, result: "NULLIFIER_USED" }), { status: 200 }),
    );
    const user = userEvent.setup();
    render(<ProvePanel credential={credential} linkedWallets={WALLETS} />);
    await user.type(screen.getByLabelText(/passphrase/i), "pass");
    await user.click(screen.getByRole("button", { name: /generate zk-proof/i }));
    await waitFor(() => expect(screen.getByText(/already been used/i)).toBeInTheDocument());
    expect(push).not.toHaveBeenCalled();
  });
});
