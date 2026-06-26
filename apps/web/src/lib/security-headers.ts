// Single source of truth for the security-header chain. Imported by next.config.ts
// and by the header test. No secrets here — pure config.

export function cspValue(isProd: boolean): string {
  // Fonts are self-hosted (BRAND.md §10), so the only origin we trust is 'self'.
  // 'wasm-unsafe-eval' is required for bb.js / noir_wasm to instantiate WASM.
  // style-src allows 'self'; Next injects nonce'd styles, never inline scripts.
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // Next.js dev + browser extensions inject inline scripts/styles, and the
    // Turbopack dev runtime / Fast Refresh use eval(). Keep prod strict; relax
    // only in development so the app is usable locally.
    "script-src": [
      "'self'",
      "'wasm-unsafe-eval'",
      ...(isProd ? [] : ["'unsafe-inline'", "'unsafe-eval'"]),
    ],
    "style-src": ["'self'", ...(isProd ? [] : ["'unsafe-inline'"])],
    "img-src": ["'self'", "data:"],
    "font-src": ["'self'"],
    // 'self' covers our own /api routes (RPC/Horizon are proxied). 'data:' is
    // required because @noir-lang/noir_js / bb.js decompress the gzipped circuit
    // bytecode by fetching a `data:application/gzip;base64,…` URL. The crs.aztec
    // hosts serve the UltraHonk SRS (g1.dat trusted-setup points) that bb.js
    // downloads on first proof — see zk:srs follow-up to self-host and drop these.
    "connect-src": [
      "'self'",
      "data:",
      "https://crs.aztec-cdn.foundation",
      "https://crs.aztec-labs.com",
    ],
    "worker-src": ["'self'", "blob:"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  };
  if (isProd) directives["upgrade-insecure-requests"] = [];
  return Object.entries(directives)
    .map(([k, v]) => (v.length ? `${k} ${v.join(" ")}` : k))
    .join("; ");
}

export function securityHeaders(isProd: boolean): { key: string; value: string }[] {
  const headers = [
    { key: "Content-Security-Policy", value: cspValue(isProd) },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    },
    // Cross-origin isolation for bb.js WASM threads (AGENT.md §5) — required everywhere.
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
  ];
  if (isProd) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }
  return headers;
}
