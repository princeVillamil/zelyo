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

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});

describe("ProvePanel", () => {
  it("defaults to disclosing only track; name and grade hidden by default", () => {
    render(<ProvePanel credential={credential} />);
    expect((screen.getByLabelText(/track/i) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText(/learner name/i) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText(/grade/i) as HTMLInputElement).checked).toBe(false);
  });

  it("proves in-browser then POSTs /api/verify and routes to the result", async () => {
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
    render(<ProvePanel credential={credential} />);
    await user.type(screen.getByLabelText(/stellar address/i), ADDR);
    await user.type(screen.getByLabelText(/passphrase/i), "pass");
    await user.click(screen.getByRole("button", { name: /generate zk-proof/i }));

    await waitFor(() => expect(proveCredential).toHaveBeenCalledOnce());
    // proof bytes are serialized as a number array; s is never in the request body
    const body = JSON.parse(((vi.mocked(global.fetch).mock.calls[0]![1] as RequestInit | undefined)?.body as string) ?? '{}');
    expect(Array.isArray(body.proof)).toBe(true);
    expect(JSON.stringify(body)).not.toContain("11".repeat(32));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/verify/result/TX123"));
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
    render(<ProvePanel credential={credential} />);
    await user.type(screen.getByLabelText(/stellar address/i), ADDR);
    await user.type(screen.getByLabelText(/passphrase/i), "pass");
    await user.click(screen.getByRole("button", { name: /generate zk-proof/i }));
    await waitFor(() => expect(screen.getByText(/already been used/i)).toBeInTheDocument());
    expect(push).not.toHaveBeenCalled();
  });
});
