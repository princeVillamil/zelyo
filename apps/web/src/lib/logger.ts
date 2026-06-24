import "server-only";
import { pino } from "pino";
import { env } from "./env";

// Redaction paths (AGENT §4): secrets + holder secret `s` + PII attributes.
// Exported so the redaction policy is unit-assertable (pino hides redact config
// behind internal symbols on the instance).
export const REDACT_PATHS = [
  "password",
  "*.password",
  "s",
  "*.s",
  "attributes",
  "*.attributes",
  "req.headers.authorization",
  "headers.authorization",
  "authorization",
  "req.headers.cookie",
  'res.headers["set-cookie"]',
  "set-cookie",
];

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
  base: { app: "zelyo-web" },
});
