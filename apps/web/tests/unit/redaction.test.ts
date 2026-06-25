import { describe, it, expect } from "vitest";
import { pino } from "pino";
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { REDACT_PATHS } from "../../src/lib/logger";

// AGENT.md §4 / SPEC §13.1: the holder secret `s`, raw `attributes`, and the
// standard auth secrets must never appear in logs or in the client bundle.

function bufferLogger() {
  const lines: string[] = [];
  const log = pino(
    { redact: { paths: REDACT_PATHS, censor: "[REDACTED]" } },
    { write: (s: string) => lines.push(s) },
  );
  return { log, read: () => lines.join("") };
}

describe("pino redaction (AGENT.md §4)", () => {
  it("censors authorization / password / set-cookie / s / attributes", () => {
    const { log, read } = bufferLogger();
    log.info(
      {
        authorization: "Bearer SECRET",
        password: "hunter2",
        "set-cookie": "session=abc",
        s: "0xholdersecret",
        attributes: { learnerName: "Ada", grade: "A+" },
      },
      "request",
    );
    const line = read();
    expect(line).not.toContain("SECRET");
    expect(line).not.toContain("hunter2");
    expect(line).not.toContain("session=abc");
    expect(line).not.toContain("0xholdersecret");
    expect(line).not.toContain("Ada");
    expect(line.match(/\[REDACTED\]/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it("declares every required redact path", () => {
    for (const p of ["authorization", "password", "set-cookie", "s", "attributes"]) {
      expect(REDACT_PATHS.join(",")).toContain(p);
    }
  });
});

describe("client bundle secret guard (SPEC §13.1)", () => {
  // Built client chunks must never reference a server-only secret. This is
  // meaningful only after `next build` produces .next/static — when that dir is
  // absent (plain `pnpm test`), skip; CI runs this after the build step.
  const staticDir = join(process.cwd(), ".next", "static");
  const built = existsSync(staticDir);

  it.skipIf(!built)("ships no holder secret or issuer secret to the client", () => {
    const hits = execSync(
      `grep -RIl --include='*.js' -e ISSUER_SECRET -e holderSecret ${staticDir} 2>/dev/null || true`,
      { encoding: "utf8" },
    ).trim();
    expect(hits).toBe("");
  });
});
