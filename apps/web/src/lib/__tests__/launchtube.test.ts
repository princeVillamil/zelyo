import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../env", () => ({
  env: {
    LAUNCHTUBE_ENABLED: "true",
    LAUNCHTUBE_URL: "https://testnet.launchtube.xyz",
    LAUNCHTUBE_JWT: "test-jwt",
  },
}));

import { isLaunchtubeEnabled, submitViaLaunchtube } from "../launchtube";
import { AppError } from "../errors";

describe("launchtube client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn() as never;
  });

  it("reports enabled when configured", () => {
    expect(isLaunchtubeEnabled()).toBe(true);
  });

  it("submits a signed XDR to Launchtube", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ hash: "tx-hash" }), {
        status: 200,
        headers: { "X-Credits-Remaining": "900000" },
      }) as never,
    );

    const result = await submitViaLaunchtube("signed-xdr");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://testnet.launchtube.xyz",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-jwt" }),
        body: expect.stringContaining("xdr=signed-xdr"),
      }),
    );
    expect(result).toMatchObject({ ok: true, status: 200, creditsRemaining: 900000 });
    expect((result.data as { hash: string }).hash).toBe("tx-hash");
  });

  it("throws AppError on Launchtube failure", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "bad request" }), { status: 400 }) as never,
    );

    await expect(submitViaLaunchtube("signed-xdr")).rejects.toBeInstanceOf(AppError);
  });
});
