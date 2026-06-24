import { describe, it, expect } from "vitest";
import { pino } from "pino";
import { REDACT_PATHS } from "../logger";

describe("logger redaction", () => {
  it("declares redaction paths for secrets and PII", () => {
    for (const p of ["password", "s", "authorization", "set-cookie", "attributes"]) {
      expect(REDACT_PATHS.join(",")).toContain(p);
    }
  });

  it("redacts configured paths in serialized output", () => {
    const lines: string[] = [];
    const probe = pino(
      { redact: { paths: REDACT_PATHS, censor: "[REDACTED]" } },
      { write: (s: string) => lines.push(s) },
    );
    probe.info(
      { password: "hunter2", s: "0xsecret", attributes: { grade: "A" } },
      "msg",
    );
    const out = lines.join("");
    expect(out).toContain("[REDACTED]");
    expect(out).not.toContain("hunter2");
    expect(out).not.toContain("0xsecret");
  });
});
