import { describe, it, expect, vi, beforeEach } from "vitest";

const send = vi.fn();
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class { send = send; },
  PutObjectCommand: class { constructor(public input: unknown) {} },
  GetObjectCommand: class { constructor(public input: unknown) {} },
}));
const getSignedUrl = vi.fn(async () => "https://signed.example/vc?sig=abc");
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl }));

vi.mock("../env", () => ({
  env: {
    S3_ENDPOINT: "http://localhost:9000",
    S3_REGION: "us-east-1",
    S3_BUCKET: "zelyo",
    S3_ACCESS_KEY_ID: "minioadmin",
    S3_SECRET_ACCESS_KEY: "minioadmin",
    S3_FORCE_PATH_STYLE: true,
  },
}));

describe("storage", () => {
  beforeEach(() => { send.mockReset(); getSignedUrl.mockClear(); });

  it("puts VC JSON as application/json", async () => {
    const { putVcJson } = await import("../storage");
    await putVcJson("vc/abc.json", { hello: "world" });
    expect(send).toHaveBeenCalledTimes(1);
    const cmd = send.mock.calls[0]![0] as { input: { ContentType: string; Bucket: string } };
    expect(cmd.input.ContentType).toBe("application/json");
    expect(cmd.input.Bucket).toBe("zelyo");
  });

  it("returns a short-lived signed url", async () => {
    const { signedVcUrl } = await import("../storage");
    const url = await signedVcUrl("vc/abc.json");
    expect(url).toContain("signed.example");
    expect(getSignedUrl).toHaveBeenCalled();
  });
});
