import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zelyo — Archival Registry for Cryptographic Truth",
  description: "ZK-backed verifiable credentials on Stellar.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading the nonce header opts every route into dynamic rendering, so Next.js
  // stamps the per-request CSP nonce (set in middleware) onto its inline scripts.
  // Otherwise statically prerendered pages ship nonce-less scripts that the strict
  // prod CSP blocks — which stops every client component from hydrating.
  await headers();
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-body text-on-background antialiased">
        {children}
      </body>
    </html>
  );
}
