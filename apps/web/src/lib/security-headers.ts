// Single source of truth for the security-header chain. The CSP is emitted by
// middleware (it carries a per-request nonce); the remaining hardening headers
// are emitted by next.config for every response. No secrets here — pure config.

export function cspValue(isProd: boolean, nonce?: string): string {
  // Fonts are self-hosted (BRAND.md §10), so the only origin we trust is 'self'.
  // 'wasm-unsafe-eval' is required for bb.js / noir_wasm to instantiate WASM.
  //
  // In prod the inline scripts Next emits for hydration/RSC streaming are
  // authorized by a per-request nonce (set in middleware), and 'strict-dynamic'
  // lets those trusted scripts pull in the chunked bundles. Without the nonce the
  // strict CSP blocks every inline script, hydration never runs, and no client
  // component (login/register forms, the home CTA) ever renders.
  const scriptSrc = ["'self'", "'wasm-unsafe-eval'"];
  if (isProd) {
    if (nonce) scriptSrc.push(`'nonce-${nonce}'`, "'strict-dynamic'");
  } else {
    // Dev (Turbopack/Fast Refresh) injects inline scripts and uses eval().
    scriptSrc.push("'unsafe-inline'", "'unsafe-eval'");
  }

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": scriptSrc,
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

// Hardening headers emitted for every response by next.config. The CSP is NOT
// here — it is set per-request in middleware so it can carry a nonce.
export function hardeningHeaders(isProd: boolean): { key: string; value: string }[] {
  const headers = [
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
