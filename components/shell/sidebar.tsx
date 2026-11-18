"use client";

import { BookMarked, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOut } from "@/actions/auth";
import { TagDot } from "@/components/common/tag-dot";
import { isActive, MAIN_NAV, SETTINGS_NAV, type NavItem } from "@/components/shell/nav";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TagWithCount } from "@/lib/tags";
import { cn } from "@/lib/utils";

type SidebarProps = {
  /** null while the session is still loading (the rest of the sidebar works already). */
  email: string | null;
  /** null while the tags are still loading. */
  tags: TagWithCount[] | null;
  /** "full" = 240px with labels (lg+ and the mobile sheet); "rail" = 64px icons only (md). */
  variant: "full" | "rail";
  /** Called after a link is clicked, e.g. to close the mobile sheet. */
  onNavigate?: () => void;
};

export function Sidebar({ email, tags, variant, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const rail = variant === "rail";

  return (
    <div className="flex h-full flex-col">
      <div
        className={cn("flex h-14 shrink-0 items-center gap-2.5", rail ? "justify-center" : "px-5")}
      >
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <BookMarked className="size-4" aria-hidden />
        </span>
        {rail ? (
          <span className="sr-only">Template Diary</span>
        ) : (
          <span className="text-base font-semibold tracking-[-0.01em]">Template Diary</span>
        )}
      </div>

      <nav
        aria-label="Main"
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-2"
      >
        {MAIN_NAV.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isActive(pathname, item.href)}
            rail={rail}
            onNavigate={onNavigate}
          />
        ))}

        {!rail ? (
          <div className="mt-5">
            <div className="flex items-center justify-between px-3 pb-2">
              <span className="text-xs font-medium tracking-[0.04em] text-subtle-foreground uppercase">
                Tags
              </span>
              <Link
                href="/settings/tags"
                onClick={onNavigate}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Manage
              </Link>
            </div>
            {tags === null ? (
              <div
                className="flex flex-col gap-2 px-3 py-1"
                role="status"
                aria-label="Loading tags"
              >
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-5" aria-hidden />
                ))}
              </div>
            ) : tags.length === 0 ? (
              <p className="px-3 text-[13px] text-subtle-foreground">No tags yet.</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {tags.map((tag) => (
                  <li key={tag.id}>
                    <Link
                      href={`/?tag=${tag.id}`}
                      onClick={onNavigate}
                      className="flex h-8 items-center gap-2.5 rounded-md px-3 text-sm text-foreground transition-colors hover:bg-surface-2"
                    >
                      <TagDot color={tag.color} />
                      <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                      <span className="text-xs text-subtle-foreground tabular-nums">
                        {tag.templateCount}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </nav>

      <div className="flex shrink-0 flex-col gap-1 border-t border-border px-3 py-3">
        <NavLink
          item={SETTINGS_NAV}
          active={isActive(pathname, SETTINGS_NAV.href)}
          rail={rail}
          onNavigate={onNavigate}
        />
        <form action={signOut}>
          {rail ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="submit"
                  aria-label="Sign out"
                  className="flex h-10 w-full cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                >
                  <LogOut className="size-5" strokeWidth={1.75} aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {email ? `Sign out (${email})` : "Sign out"}
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-2 rounded-md px-3 py-1.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary uppercase">
                {email?.charAt(0)}
              </span>
              {email ? (
                <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
                  {email}
                </span>
              ) : (
                <Skeleton className="h-4 flex-1" aria-hidden />
              )}
              <button
                type="submit"
                aria-label="Sign out"
                title="Sign out"
                className="flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <LogOut className="size-4" aria-hidden />
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

function NavLink({
  item,
  active,
  rail,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  rail: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={rail ? item.label : undefined}
      className={cn(
        "flex items-center rounded-md text-sm font-medium transition-colors",
        rail ? "h-10 justify-center" : "h-9 gap-3 px-3",
        active ? "bg-primary-soft text-primary" : "text-foreground hover:bg-surface-2",
      )}
    >
      <Icon
        className={cn("size-5 shrink-0", active ? "text-primary" : "text-muted-foreground")}
        strokeWidth={1.75}
        aria-hidden
      />
      {rail ? null : item.label}
    </Link>
  );

  if (!rail) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}
