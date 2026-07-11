import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const submitTransaction = vi.fn();

vi.mock("@openzeppelin/relayer-plugin-channels", () => ({
  ChannelsClient: vi.fn(function () {
    return { submitTransaction };
  }),
}));

vi.mock("../env", () => ({
  env: {
    USE_CHANNELS: "true",
    CHANNELS_URL: "https://channels.openzeppelin.com/testnet",
    CHANNELS_API_KEY: "test-api-key",
  },
}));

beforeEach(() => {
  submitTransaction.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("channels", () => {
  it("submitSponsored posts the signed XDR and returns the hash", async () => {
    submitTransaction.mockResolvedValueOnce({ hash: "CHANNELSHASH", status: "PENDING" });

    const { submitSponsored } = await import("../channels");
    const result = await submitSponsored("AAAA...");

    expect(result).toEqual({ hash: "CHANNELSHASH", status: "PENDING" });
    expect(submitTransaction).toHaveBeenCalledWith({ xdr: "AAAA..." });
  });

  it("submitSponsored throws when the response lacks a hash", async () => {
    submitTransaction.mockResolvedValueOnce({ status: "PENDING" });

    const { submitSponsored } = await import("../channels");
    await expect(submitSponsored("AAAA...")).rejects.toThrow("transaction hash");
  });

  it("submitSponsored throws when the relayer throws", async () => {
    submitTransaction.mockRejectedValueOnce(new Error("Channels submission failed (401): Unauthorized"));

    const { submitSponsored } = await import("../channels");
    await expect(submitSponsored("AAAA...")).rejects.toThrow("Channels submission failed (401): Unauthorized");
  });
});
