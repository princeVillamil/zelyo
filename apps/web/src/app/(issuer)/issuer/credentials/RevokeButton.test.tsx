import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RevokeButton } from "./RevokeButton";

describe("RevokeButton", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("POSTs to the revoke endpoint and shows REVOKED on success", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "c1", txHash: "TX" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<RevokeButton credentialId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: /revoke/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/issuer/credentials/c1/revoke", expect.objectContaining({ method: "POST" })));
    expect(await screen.findByText(/revoked/i)).toBeInTheDocument();
  });

  it("surfaces the server error message on failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: "already revoked" } }), { status: 409 })));
    render(<RevokeButton credentialId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: /revoke/i }));
    expect(await screen.findByText(/already revoked/i)).toBeInTheDocument();
  });
});
