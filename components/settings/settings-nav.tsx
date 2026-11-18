"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "/settings/tags", label: "Tags" },
  { href: "/settings/account", label: "Account" },
] as const;

const LATER = [
  { label: "Backup", phase: "Phase 10" },
  { label: "Preferences", phase: "Phase 11" },
] as const;

/** DESIGN.md §7.8: left sub-nav on desktop, top tabs on mobile. */
export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Settings"
      className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 md:mx-0 md:flex-col md:border-b-0 md:px-0"
    >
      {SECTIONS.map((s) => {
        const active = pathname === s.href;
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 text-sm font-medium transition-colors",
              "border-b-2 px-3 py-2.5 md:rounded-md md:border-b-0 md:py-2",
              active
                ? "border-primary text-primary md:bg-primary-soft"
                : "border-transparent text-foreground hover:text-primary md:hover:bg-surface-2 md:hover:text-foreground",
            )}
          >
            {s.label}
          </Link>
        );
      })}
      {LATER.map((s) => (
        <span
          key={s.label}
          title={`Coming in ${s.phase}`}
          className="flex shrink-0 items-center gap-2 border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-subtle-foreground md:border-b-0 md:py-2"
        >
          {s.label}
          <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium">
            Soon
          </span>
        </span>
      ))}
    </nav>
  );
}
