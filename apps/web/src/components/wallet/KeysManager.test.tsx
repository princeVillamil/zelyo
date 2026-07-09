import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FieldHex } from "@zelyo/zk-shared";

vi.mock("@/lib/holder-key.client", () => ({
  generateHolderSecret: vi.fn(),
  persistHolderSecret: vi.fn(async () => {}),
  loadHolderSecret: vi.fn(),
  hasHolderSecret: vi.fn(async () => false),
  exportBackup: vi.fn(async () => '{"kind":"zelyo-holder-backup"}'),
  restoreBackup: vi.fn(),
  deriveIdCommitment: vi.fn(),
}));

import { KeysManager } from "./KeysManager";
import * as keys from "@/lib/holder-key.client";

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn(async () => new Response("{}", { status: 200 })) as never;
});

describe("KeysManager", () => {
  it("generates s, derives the commitment, persists it, and PUTs only the commitment (never s)", async () => {
    const s = ("0x" + "11".repeat(32)) as FieldHex;
    const commitment = ("0x" + "22".repeat(32)) as FieldHex;
    vi.mocked(keys.generateHolderSecret).mockResolvedValue(s);
    vi.mocked(keys.deriveIdCommitment).mockReturnValue(commitment);

    const user = userEvent.setup();
    render(<KeysManager />);
    await user.type(screen.getByLabelText(/passphrase/i), "vault");
    await user.click(screen.getByRole("button", { name: /generate identity/i }));

    await waitFor(() => expect(keys.persistHolderSecret).toHaveBeenCalledWith(s, "vault"));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/holder/commitment", expect.anything()));
    const body = ((vi.mocked(global.fetch).mock.calls[0]![1] as RequestInit | undefined)?.body as string) ?? "{}";
    expect(JSON.parse(body)).toEqual({ idCommitment: commitment });
    expect(body).not.toContain("11".repeat(32)); // s never transmitted
    await waitFor(() => expect(screen.getByText(new RegExp(commitment.slice(0, 10)))).toBeInTheDocument());
  });

  it("restores a backup blob client-side and shows the recovered commitment", async () => {    const s = ("0x" + "33".repeat(32)) as FieldHex;
    const commitment = ("0x" + "44".repeat(32)) as FieldHex;
    vi.mocked(keys.restoreBackup).mockResolvedValue(s);
    vi.mocked(keys.deriveIdCommitment).mockReturnValue(commitment);

    const user = userEvent.setup();
    render(<KeysManager />);
    await user.type(screen.getByLabelText(/passphrase/i), "vault");
    fireEvent.change(screen.getByLabelText(/backup blob/i), { target: { value: '{"kind":"zelyo-holder-backup"}' } });
    await user.click(screen.getByRole("button", { name: /restore/i }));
    await waitFor(() => expect(keys.restoreBackup).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(new RegExp(commitment.slice(0, 10)))).toBeInTheDocument());
  });

  it("on 409, confirms before forcing the replace and only then persists the new secret", async () => {
    const s = ("0x" + "55".repeat(32)) as FieldHex;
    const commitment = ("0x" + "66".repeat(32)) as FieldHex;
    vi.mocked(keys.generateHolderSecret).mockResolvedValue(s);
    vi.mocked(keys.deriveIdCommitment).mockReturnValue(commitment);
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "would orphan 2 credential(s)" } }), { status: 409 }),
      )
      .mockResolvedValueOnce(new Response("{}", { status: 200 })) as never;

    const user = userEvent.setup();
    render(<KeysManager />);
    await user.type(screen.getByLabelText(/passphrase/i), "vault");
    await user.click(screen.getByRole("button", { name: /generate identity/i }));

    // Wait for replacement UI to appear
    await waitFor(() => expect(screen.getByRole("button", { name: /replace anyway/i })).toBeInTheDocument());
    
    // Click "Replace Anyway"
    await user.click(screen.getByRole("button", { name: /replace anyway/i }));

    await waitFor(() => expect(keys.persistHolderSecret).toHaveBeenCalledWith(s, "vault"));
    // Second PUT carries force: true.
    const retryBody = (vi.mocked(global.fetch).mock.calls[1]![1] as RequestInit).body as string;
    expect(JSON.parse(retryBody)).toEqual({ idCommitment: commitment, force: true });
  });

  it("on 409, cancelling the confirm leaves the local secret untouched", async () => {
    const s = ("0x" + "77".repeat(32)) as FieldHex;
    const commitment = ("0x" + "88".repeat(32)) as FieldHex;
    vi.mocked(keys.generateHolderSecret).mockResolvedValue(s);
    vi.mocked(keys.deriveIdCommitment).mockReturnValue(commitment);
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ error: { message: "would orphan" } }), { status: 409 })) as never;

    const user = userEvent.setup();
    render(<KeysManager />);
    await user.type(screen.getByLabelText(/passphrase/i), "vault");
    await user.click(screen.getByRole("button", { name: /generate identity/i }));

    // Wait for replacement UI to appear
    await waitFor(() => expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument());

    // Click "Cancel"
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(keys.persistHolderSecret).not.toHaveBeenCalled();
    expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(1); // no forced retry
  });
});
