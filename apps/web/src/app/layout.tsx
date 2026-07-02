import type { Metadata } from "next";
import { headers } from "next/headers";
import { auth } from "../auth";
import { SiteRail, type RailRole } from "../components/SiteRail";
import { SectionNav } from "../components/SectionNav";
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
  const session = await auth();
  const role = (session?.user?.role ?? null) as RailRole;
  const username = session?.user?.name ?? session?.user?.email ?? null;

  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-body text-on-background antialiased">
        {/* Rail is pinned to the far-left edge of the viewport; content clears its
            64px width on desktop, stays centered in a 1400px frame, and keeps a
            comfortable horizontal margin on both edges. */}
        <SiteRail role={role} username={username} />
        <div className="md:pl-16">
          <div className="relative mx-auto max-w-[1400px] px-margin-mobile md:px-margin-page">
            <SectionNav role={role} />
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
