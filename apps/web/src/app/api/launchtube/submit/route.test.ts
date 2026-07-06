import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "@/lib/errors";

vi.mock("@/lib/launchtube", () => ({
  submitViaLaunchtube: vi.fn(),
}));
vi.mock("@/lib/ratelimit", () => ({
  limiters: { launchtube: {} },
  consumeOrThrow: vi.fn(),
  clientIp: (headers: Headers) => (headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown",
}));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));

import { POST } from "./route";
import { submitViaLaunchtube } from "@/lib/launchtube";
import { consumeOrThrow } from "@/lib/ratelimit";

const req = (body: unknown) =>
  new Request("http://x/api/launchtube/submit", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "1.1.1.1" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(consumeOrThrow).mockResolvedValue(undefined);
});

describe("POST /api/launchtube/submit", () => {
  it("submits a signed XDR and returns the Launchtube result", async () => {
    vi.mocked(submitViaLaunchtube).mockResolvedValue({
      ok: true,
      status: 200,
      data: { hash: "tx-hash" },
      creditsRemaining: 900000,
    });

    const res = await POST(req({ xdr: "signed-xdr" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, data: { hash: "tx-hash" } });
    expect(submitViaLaunchtube).toHaveBeenCalledWith("signed-xdr");
  });

  it("returns 400 when XDR is missing", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
    expect(submitViaLaunchtube).not.toHaveBeenCalled();
  });

  it("propagates 429 from rate limiter", async () => {
    vi.mocked(consumeOrThrow).mockRejectedValue(new AppError("RATE_LIMITED", 429, "Slow down."));
    const res = await POST(req({ xdr: "x" }));
    expect(res.status).toBe(429);
  });
});
