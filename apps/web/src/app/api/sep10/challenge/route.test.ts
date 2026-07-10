import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/sep10/challenge/route";

const { buildChallenge } = vi.hoisted(() => ({
  buildChallenge: vi.fn(),
}));

vi.mock("@/server/sep10.service", () => ({
  buildChallenge,
}));

vi.mock("@/lib/ratelimit", () => ({
  limiters: { sep10: {} },
  consumeOrThrow: vi.fn(),
  clientIp: () => "127.0.0.1",
}));

vi.mock("@/lib/audit", () => ({
  audit: vi.fn(),
}));

describe("GET /api/sep10/challenge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildChallenge.mockReset();
  });

  it("returns a challenge transaction", async () => {
    buildChallenge.mockResolvedValue("base64-challenge-xdr");

    const res = await GET(new Request(`http://localhost/api/sep10/challenge?account=G${"A".repeat(55)}`));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.transaction).toBe("base64-challenge-xdr");
    expect(buildChallenge).toHaveBeenCalledWith(`G${"A".repeat(55)}`);
  });

  it("returns 400 for invalid account", async () => {
    const res = await GET(new Request("http://localhost/api/sep10/challenge?account=invalid"));
    expect(res.status).toBe(400);
  });
});
