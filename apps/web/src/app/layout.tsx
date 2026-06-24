import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zelyo — Archival Registry for Cryptographic Truth",
  description: "ZK-backed verifiable credentials on Stellar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-body text-on-background antialiased">
        {children}
      </body>
    </html>
  );
}
