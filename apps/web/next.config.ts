import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["@node-rs/argon2", "pino", "@stellar/stellar-sdk"],
  async headers() {
    return [
      {
        // Every route, including the app shell, the prover page, and /circuit/* artifacts.
        source: "/:path*",
        headers: securityHeaders(isProd),
      },
    ];
  },
};

export default nextConfig;
