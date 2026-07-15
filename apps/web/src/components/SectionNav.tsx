"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type SectionRole = "ADMIN" | "HOLDER" | null;

type SubLink = { href: string; label: string; exact?: boolean; activeFor?: string[] };
type Section = { label: string; links: SubLink[] };

/** Resolve the current section (and the pages within it) from the path + role.
 *  Role-gated so it only ever offers pages the visitor can actually open. */
function sectionFor(pathname: string, role: SectionRole): Section | null {
  if (pathname === "/jobs" || pathname.startsWith("/jobs/")) {
    return { label: "The Public Board", links: [] };
  }
  if ((pathname === "/wallet" || pathname.startsWith("/wallet/")) && role === "HOLDER") {
    return {
      label: "Holder Wallet",
      links: [
        { href: "/wallet", label: "Credentials", exact: true, activeFor: ["/wallet/credentials", "/wallet/prove"] },
        { href: "/wallet/keys", label: "Keys" },
      ],
    };
  }
  if ((pathname === "/issuer" || pathname.startsWith("/issuer/")) && role === "ADMIN") {
    return {
      label: "Issuer Portal",
      links: [
        { href: "/issuer", label: "Dashboard", exact: true },
        { href: "/issuer/mint", label: "Mint" },
        { href: "/issuer/gates", label: "Gates" },
      ],
    };
  }
  return null;
}

function linkActive(pathname: string, link: SubLink): boolean {
  if (pathname === link.href) return true;
  const prefixes = link.activeFor ?? (link.exact ? [] : [link.href]);
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Section sub-navigation, right-aligned to read as part of the page header (title on
 * the left, this on the far right). Shows the pages within the current section for the
 * current role. The section name is intentionally omitted — every page's eyebrow already
 * names its section, so repeating it here is redundant. Renders nothing on pages with no
 * section (home, verify, auth) or sections with no sub-pages (the Public Board).
 */
export function SectionNav({ role }: { role: SectionRole }) {
  const pathname = usePathname();
  const section = sectionFor(pathname, role);
  if (!section || section.links.length === 0) return null;

  return (
    <nav
      aria-label={section.label}
      className="absolute right-margin-mobile top-stack-lg z-10 flex max-w-[65%] flex-wrap items-baseline justify-end gap-x-stack-md gap-y-unit md:right-margin-page"
    >
      {section.links.map((link) => {
        const active = linkActive(pathname, link);
        return (
          <Link
            key={`${link.href}-${link.label}`}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`font-label text-label-md uppercase tracking-[0.05em] transition-colors ${
              active ? "text-primary" : "text-on-surface-variant hover:text-on-background"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
