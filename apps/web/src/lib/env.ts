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

  ADMIN_USERNAME: z.string().min(1),
  ADMIN_PASSWORD: z.string().min(8),
  ISSUER_NAME: z.string().min(1),
  ISSUER_STELLAR_ACCOUNT: z.string().min(1),

  // SEP-10 web authentication
  // SEP10_SIGNER_SECRET is optional at build time; runtime guards in sep10.service throw
  // if the feature is used without a configured signer.
  SEP10_HOME_DOMAIN: z.string().min(1).default("localhost:3000"),
  SEP10_SIGNER_SECRET: z.string().min(1).optional(),
  SEP10_CHALLENGE_TTL_SECONDS: z.coerce.number().int().min(60).default(300),
  SEP10_JWT_MAX_AGE_SECONDS: z.coerce.number().int().min(60).default(900),
  SEP10_JWT_SECRET: z.union([z.string().min(32), z.literal("")]).optional(),

  // Passkey-kit smart wallets (client-side config)
  NEXT_PUBLIC_PASSKEY_KIT_RPC_URL: z.string().url().optional(),
  NEXT_PUBLIC_PASSKEY_KIT_NETWORK_PASSPHRASE: z.string().min(1).optional(),
  NEXT_PUBLIC_PASSKEY_KIT_WALLET_WASM_HASH: z.string().min(1).optional(),

  // OpenZeppelin Stellar Channels fee sponsorship for gasless verify/claim transactions
  USE_CHANNELS: boolish.default(false),
  CHANNELS_URL: z.string().url().optional(),
  CHANNELS_API_KEY: z.string().min(1).optional(),

  // SEP-38 anchor RFQ (indicative prices + firm quotes for fiat/crypto conversion).
  // Optional at build time; the SEP-38 service runtime-guards these and throws if the
  // feature is used without a configured anchor.
  SEP38_ANCHOR_URL: z.string().url().optional(),
  SEP38_API_KEY: z.string().min(1).optional(),

  // SDEX asset-choice at claim: comma-separated CODE:ISSUER pairs the holder may
  // choose to receive a native-XLM gate reward in, converted via a strict-send path
  // payment (empty issuer segment = native XLM). Optional; when unset the claim
  // flow offers no asset choice.
  SDEX_RECEIVE_ASSETS: z.string().optional(),

  // Feature gates (client-readable)
  NEXT_PUBLIC_SEP45_ENABLED: boolish.default(false),

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
