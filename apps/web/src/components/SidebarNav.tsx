"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; icon?: string };

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex w-64 flex-col gap-1 bg-surface-container-low p-stack-md">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`border-l-2 px-stack-md py-2 font-label text-label-md uppercase tracking-[0.05em] transition-colors hover:bg-surface-container ${
              active
                ? "border-primary bg-secondary-container text-primary"
                : "border-transparent text-on-surface-variant"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
