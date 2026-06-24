import { describe, it, expect } from "vitest";
import { mintLogChannel, formatMintLine } from "./mintlog";

describe("mintlog", () => {
  it("namespaces channels per job", () => {
    expect(mintLogChannel("abc")).toBe("zelyo:mintlog:abc");
  });

  it("formats a line as [HH:MM:SS] EVENT … STATUS with no PII", () => {
    const line = formatMintLine({
      ts: "2026-06-23T09:04:01.000Z",
      event: "PUBLISH_ROOT",
      status: "OK",
      detail: "tx 9f3a…",
    });
    expect(line).toMatch(/^\[\d{2}:\d{2}:\d{2}\] PUBLISH_ROOT … OK/);
    expect(line).toContain("tx 9f3a…");
    expect(line).not.toMatch(/learner|grade|name=/i);
  });
});
