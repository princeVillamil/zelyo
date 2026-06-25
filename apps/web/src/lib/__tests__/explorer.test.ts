import { describe, expect, it, vi } from "vitest";

vi.mock("../env", () => ({
  env: { NEXT_PUBLIC_EXPLORER_BASE: "https://stellar.expert/explorer/testnet" },
}));

import { explorerTxUrl } from "../explorer";

describe("explorerTxUrl", () => {
  it("joins base and tx hash without double slashes", () => {
    expect(explorerTxUrl("abc123")).toBe(
      "https://stellar.expert/explorer/testnet/tx/abc123",
    );
  });

  it("tolerates a trailing slash on the base", async () => {
    vi.resetModules();
    vi.doMock("../env", () => ({
      env: { NEXT_PUBLIC_EXPLORER_BASE: "https://stellar.expert/explorer/testnet/" },
    }));
    const mod = await import("../explorer");
    expect(mod.explorerTxUrl("abc123")).toBe(
      "https://stellar.expert/explorer/testnet/tx/abc123",
    );
  });
});
