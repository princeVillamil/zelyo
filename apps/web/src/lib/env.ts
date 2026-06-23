import { z } from "zod";

const boolish = z
  .enum(["true", "false"])
  .transform((v) => v === "true");

const optionalString = z.string().optional().default("");

const EnvSchema = z.object({
  // Core
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  // Auth.js
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be >= 32 chars"),
  AUTH_URL: z.string().url(),
  AUTH_TRUST_HOST: boolish.default(true),

  // Database
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url(),

  // Object storage
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: boolish.default(true),

  // Stellar / Soroban
  STELLAR_NETWORK: z.enum(["testnet", "futurenet", "mainnet"]).default("testnet"),
  NETWORK_PASSPHRASE: z.string().min(1),
  SOROBAN_RPC_URL: z.string().url(),
  HORIZON_URL: z.string().url(),
  ISSUER_SECRET: z.string().min(1),
  CREDENTIAL_REGISTRY_CONTRACT_ID: optionalString,
  VERIFIER_CONTRACT_ID: optionalString,

  // ZK
  ZK_SCOPE_APP_ID: z.string().min(1),
  ZK_VERIFY_MODE: z.enum(["onchain", "server"]),
  CIRCUIT_ARTIFACT_BASE: z.string().min(1).default("/circuit"),

  // Seed
  ADMIN_USERNAME: z.string().min(1),
  ADMIN_PASSWORD: z.string().min(8),
  ISSUER_NAME: z.string().min(1),
  ISSUER_STELLAR_ACCOUNT: optionalString,

  // Public
  NEXT_PUBLIC_EXPLORER_BASE: z.string().url(),
});

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = EnvSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return Object.freeze(result.data);
}

let cachedEnv: Env | undefined;

/**
 * The validated, frozen environment — parsed once, lazily, from `process.env`.
 * The first access fails fast if the environment is invalid (at app boot, where
 * `env` is read during initialization). Kept lazy so importing `parseEnv` in a
 * unit test does not require a fully-populated `process.env`.
 */
export function loadEnv(): Env {
  cachedEnv ??= parseEnv(process.env as Record<string, string | undefined>);
  return cachedEnv;
}

export const env: Env = new Proxy({} as Env, {
  get(_target, prop) {
    return loadEnv()[prop as keyof Env];
  },
});
