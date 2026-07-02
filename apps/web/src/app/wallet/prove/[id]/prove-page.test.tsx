import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/merkle.service", () => ({
  getMerkleProof: vi.fn(async () => ({ siblings: ["0xaa"], pathIndices: [0], rootHex: "0xroot" })),
}));
vi.mock("@/lib/db", () => ({
  db: { holderKey: { findUnique: vi.fn() }, credential: { findFirst: vi.fn() } },
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => { throw new Error("REDIRECT"); }),
  notFound: () => { throw new Error("NOT_FOUND"); },
}));
// Render ProvePanel as a stub to keep this test about the page wiring.
vi.mock("@/components/wallet/ProvePanel", () => ({
  ProvePanel: ({ credential }: { credential: { id: string } }) => <div>panel:{credential.id}</div>,
}));

import { redirect } from "next/navigation";

import ProvePage from "./page";
import { auth } from "@/auth";
import { db } from "@/lib/db";

beforeEach(() => vi.clearAllMocks());

describe("/wallet/prove/[id]", () => {
  it("redirects non-holders to login", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    await expect(ProvePage({ params: Promise.resolve({ id: "c1" }), searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("renders ProvePanel with the credential + merkle path for the owner", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1", role: "HOLDER" } } as never);
    vi.mocked(db.holderKey.findUnique).mockResolvedValue({ id: "hk1" } as never);
    vi.mocked(db.credential.findFirst).mockResolvedValue({
      id: "c1", attributes: { track: "Data Engineering" }, leafIndex: 3, merkleRootHex: "0xroot",
    } as never);
    const ui = await ProvePage({ params: Promise.resolve({ id: "c1" }), searchParams: Promise.resolve({}) });
    render(ui);
    expect(screen.getByText("panel:c1")).toBeInTheDocument();
  });
});
