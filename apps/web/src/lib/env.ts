import { z } from "zod";

const boolish = z
  .enum(["true", "false"])
  .transform((v) => v === "true");

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url(),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be >= 32 chars"),
  AUTH_URL: z.string().url(),
  AUTH_TRUST_HOST: boolish.default(true),

  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),

  REDIS_URL: z.string().min(1),

  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: boolish.default(true),

  STELLAR_NETWORK: z.string().min(1),
  NETWORK_PASSPHRASE: z.string().min(1),
  SOROBAN_RPC_URL: z.string().url(),
  HORIZON_URL: z.string().url(),
  ISSUER_SECRET: z.string().min(1),
  CREDENTIAL_REGISTRY_CONTRACT_ID: z.string().min(1),
  VERIFIER_CONTRACT_ID: z.string().optional(),

  ZK_SCOPE_APP_ID: z.string().min(1),
  ZK_VERIFY_MODE: z.enum(["onchain", "server"]).default("server"),
  CIRCUIT_ARTIFACT_BASE: z.string().min(1).default("/circuit"),

  // Passkey smart-wallet (SEP-45 style via passkey-kit). Optional until configured.
  NEXT_PUBLIC_PASSKEY_KIT_RPC_URL: z.string().url().optional(),
  NEXT_PUBLIC_PASSKEY_KIT_NETWORK_PASSPHRASE: z.string().min(1).optional(),
  NEXT_PUBLIC_PASSKEY_KIT_WALLET_WASM_HASH: z.string().min(1).optional(),

  // Launchtube fee sponsorship. Optional until configured.
  LAUNCHTUBE_URL: z.string().url().optional(),
  LAUNCHTUBE_JWT: z.string().min(1).optional(),
  LAUNCHTUBE_ENABLED: boolish.default(false),

  ADMIN_USERNAME: z.string().min(1),
  ADMIN_PASSWORD: z.string().min(8),
  ISSUER_NAME: z.string().min(1),
  ISSUER_STELLAR_ACCOUNT: z.string().min(1),

  NEXT_PUBLIC_EXPLORER_BASE: z.string().url().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = EnvSchema.safeParse(raw);
  if (!result.success) {
    // Do not print values — only which keys failed (avoid leaking secrets).
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return Object.freeze(result.data);
}

let cachedEnv: Env | undefined;

/**
 * The validated, frozen environment — parsed once, lazily, from `process.env`.
 * The first access fails fast if the environment is invalid (at app boot, where
 * `env` is read during initialization). Kept lazy so `next build` (which runs
 * with no app env) and unit tests do not parse a fully-populated env at import.
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
