"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";

export type RailRole = "ADMIN" | "HOLDER" | null;

export type SiteRailProps = {
  role: RailRole;
  username: string | null;
};

type RailItem = { href: string; label: string; cta?: boolean };

function navForRole(role: RailRole): RailItem[] {
  const links: RailItem[] = [{ href: "/jobs", label: "Board" }];
  if (role === "HOLDER") links.push({ href: "/wallet", label: "Wallet" });
  if (role === "ADMIN") links.push({ href: "/issuer", label: "Issuer" });
  return links;
}

/** A link is active when the path is the link itself or a child of it. */
function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Corner-anchored navigation rail. In its resting state each item is a short hairline
 * tick (a scroll-spy-like stack); hovering an item grows the tick rightward, fades in
 * its label on a cream plate, and dims the rest of the page with a translucent ink
 * scrim so focus snaps to the item. Reference micro-interaction, Zelyo palette.
 *
 * The tick / expanded widths are CSS variables (set on the rail) so the scale is easy
 * to tweak in one place.
 */
export function SiteRail({ role, username }: SiteRailProps) {
  const pathname = usePathname();
  const [activeTick, setActiveTick] = useState<string | null>(null);
  const dimmed = activeTick !== null;
  const nav = navForRole(role);
  const authed = role !== null;

  const auth: RailItem[] = authed
    ? []
    : [
        { href: "/login", label: "Sign in" },
        { href: "/register", label: "Register", cta: true },
      ];

  const handleActive = (label: string) => () => setActiveTick(label);
  const handleInactive = (label: string) => () =>
    setActiveTick((prev) => (prev === label ? null : prev));

  return (
    <>
      {/* ── Mobile: a plain top strip (hover-expand doesn't apply to touch) ── */}
      <div className="flex items-center gap-gutter border-b border-outline-variant bg-background px-margin-mobile py-4 md:hidden">
        <Link href="/" className="font-display text-body-lg leading-none tracking-[-0.01em] text-primary">
          Zelyo
        </Link>
        <nav className="ml-auto flex items-center gap-stack-md">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={`font-label text-label-md uppercase tracking-[0.05em] ${
                isActive(pathname, item.href) ? "text-primary" : "text-on-surface-variant"
              }`}
            >
              {item.label}
            </Link>
          ))}
          {auth.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`font-label text-label-md uppercase tracking-[0.05em] ${
                item.cta ? "text-primary" : "text-on-surface-variant"
              }`}
            >
              {item.label}
            </Link>
          ))}
          {authed && (
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="font-label text-label-md uppercase tracking-[0.05em] text-on-surface-variant"
            >
              Log out
            </button>
          )}
        </nav>
      </div>

      {/* ── Desktop: the animated hairline-tick rail ── */}
      <aside
        className="site-rail fixed left-0 top-0 z-40 hidden h-screen w-16 shrink-0 flex-col overflow-visible bg-background px-3 py-8 md:flex"
      >
        {/* Logo — far top-left of the frame */}
        <Link
          href="/"
          className="font-display text-label-md leading-none tracking-[-0.01em] text-primary"
        >
          Zelyo
        </Link>

        {/* Primary nav — vertically centered stack of ticks */}
        <nav className="flex flex-1 flex-col justify-center gap-5">
          {nav.map((item) => (
            <RailTick
              key={item.href}
              href={item.href}
              label={item.label}
              active={isActive(pathname, item.href)}
              onActive={handleActive(item.label)}
              onInactive={handleInactive(item.label)}
            />
          ))}
        </nav>

        {/* Auth + log out — pinned to the bottom */}
        <div className="flex flex-col gap-5">
          {authed ? (
            <>
              {username && (
                <span className="truncate font-mono text-caption text-on-surface-variant">
                  {username}
                </span>
              )}
              <RailAction
                label="Log out"
                onClick={() => signOut({ callbackUrl: "/" })}
                onActive={handleActive("Log out")}
                onInactive={handleInactive("Log out")}
              />
            </>
          ) : (
            auth.map((item) => (
              <RailTick
                key={item.href}
                href={item.href}
                label={item.label}
                cta={item.cta ?? false}
                onActive={handleActive(item.label)}
                onInactive={handleInactive(item.label)}
              />
            ))
          )}
        </div>
      </aside>

      {/* ── Rail edge ornament: vertical hairline with a lozenge ── */}
      <div
        aria-hidden="true"
        className="fixed left-16 top-0 z-40 hidden h-screen flex-col items-center py-8 md:flex"
      >
        <div className="w-px flex-1 bg-outline-variant" />
        <span className="py-2 text-caption text-secondary">◆</span>
        <div className="w-px flex-1 bg-outline-variant" />
      </div>

      {/* ── Dimmer: translucent ink scrim between content and rail ── */}
      <div
        aria-hidden
        className={`pointer-events-none fixed inset-0 z-30 bg-primary/70 transition-opacity duration-300 ease-in-out motion-reduce:transition-none ${
          dimmed ? "opacity-100" : "opacity-0"
        }`}
      />
    </>
  );
}

function RailAction({
  label,
  onClick,
  onActive,
  onInactive,
}: {
  label: string;
  onClick: () => void;
  onActive?: () => void;
  onInactive?: () => void;
}) {
  // Same tick micro-interaction as RailTick, but for actions (no navigation).
  const handlers: {
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    onFocus?: () => void;
    onBlur?: () => void;
  } = {};
  if (onActive) {
    handlers.onMouseEnter = onActive;
    handlers.onFocus = onActive;
  }
  if (onInactive) {
    handlers.onMouseLeave = onInactive;
    handlers.onBlur = onInactive;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="group/tick relative flex h-4 items-center focus-visible:outline-none"
      {...handlers}
    >
      <span
        className="h-[2px] w-[var(--tick)] rounded-full bg-on-surface-variant/45 transition-all duration-300 ease-in-out group-hover/tick:w-[var(--tick-expanded)] group-hover/tick:bg-primary-fixed-dim group-focus-visible/tick:w-[var(--tick-expanded)] group-focus-visible/tick:bg-primary-fixed-dim motion-reduce:transition-none"
      />
      <span className="pointer-events-none absolute top-1/2 left-[calc(var(--tick-expanded)_+_14px)] -translate-y-1/2 whitespace-nowrap font-label text-label-md uppercase tracking-[0.05em] text-background opacity-0 transition-opacity duration-300 ease-in-out group-hover/tick:opacity-100 group-focus-visible/tick:opacity-100 motion-reduce:transition-none">
        {label}
      </span>
    </button>
  );
}

function RailTick({
  href,
  label,
  active = false,
  cta = false,
  onActive,
  onInactive,
}: {
  href: string;
  label: string;
  active?: boolean;
  cta?: boolean;
  onActive?: () => void;
  onInactive?: () => void;
}) {
  // Resting tick color: muted on cream; CTA + active get the foil green. On hover the
  // page dims, so the tick switches to pale mint to stay visible over the ink scrim.
  const restColor = cta || active ? "bg-primary" : "bg-on-surface-variant/45";
  // Base width is a class (not inline) so the group-hover width override can win.
  const restWidth = active ? "w-[var(--tick-active)]" : "w-[var(--tick)]";

  const handlers: {
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    onFocus?: () => void;
    onBlur?: () => void;
  } = {};
  if (onActive) {
    handlers.onMouseEnter = onActive;
    handlers.onFocus = onActive;
  }
  if (onInactive) {
    handlers.onMouseLeave = onInactive;
    handlers.onBlur = onInactive;
  }

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      title={label}
      className="group/tick relative flex h-4 items-center focus-visible:outline-none"
      {...handlers}
    >
      <span
        className={`h-[2px] rounded-full transition-all duration-300 ease-in-out group-hover/tick:w-[var(--tick-expanded)] group-hover/tick:bg-primary-fixed-dim group-focus-visible/tick:w-[var(--tick-expanded)] group-focus-visible/tick:bg-primary-fixed-dim motion-reduce:transition-none ${restColor} ${restWidth}`}
      />
      {/* Label — plain cream text so it reads over the dimmed page, sitting just
          past the rail edge */}
      <span className="pointer-events-none absolute top-1/2 left-[calc(var(--tick-expanded)_+_14px)] -translate-y-1/2 whitespace-nowrap font-label text-label-md uppercase tracking-[0.05em] text-background opacity-0 transition-opacity duration-300 ease-in-out group-hover/tick:opacity-100 group-focus-visible/tick:opacity-100 motion-reduce:transition-none">
        {label}
      </span>
    </Link>
  );
}
