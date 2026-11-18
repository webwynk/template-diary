"use client";

import { Menu, Plus, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { CommandMenu } from "@/components/shell/command-menu";
import { titleFor } from "@/components/shell/nav";
import { ShortcutHint } from "@/components/shell/shortcut-hint";
import { Sidebar } from "@/components/shell/sidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { TagWithCount } from "@/lib/tags";

type AppShellProps = {
  email: string;
  tags: TagWithCount[];
  children: React.ReactNode;
};

/**
 * DESIGN.md §6 app shell. Sidebar: 240px with labels at lg+, 64px icon rail at md,
 * a left sheet opened from the menu button below md.
 */
export function AppShell({ email, tags, children }: AppShellProps) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex min-h-svh w-full">
        <aside className="sticky top-0 hidden h-svh w-16 shrink-0 border-r border-border bg-surface md:block lg:hidden">
          <Sidebar email={email} tags={tags} variant="rail" />
        </aside>
        <aside className="sticky top-0 hidden h-svh w-60 shrink-0 border-r border-border bg-surface lg:block">
          <Sidebar email={email} tags={tags} variant="full" />
        </aside>

        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="w-72 max-w-[85vw] gap-0 bg-surface p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SheetDescription className="sr-only">Main navigation and tags</SheetDescription>
            <Sidebar
              email={email}
              tags={tags}
              variant="full"
              onNavigate={() => setMobileNavOpen(false)}
            />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-4 md:px-6 lg:px-8">
            <Button
              variant="ghost"
              size="icon"
              className="-ml-2 md:hidden"
              aria-label="Open navigation"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="size-5" aria-hidden />
            </Button>
            <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-[-0.01em] md:text-2xl">
              {titleFor(pathname)}
            </h1>

            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              aria-keyshortcuts="Control+K Meta+K"
              className="flex size-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-background text-sm text-muted-foreground shadow-xs transition-colors hover:border-border-strong sm:h-9 sm:w-56 sm:justify-start sm:px-3"
            >
              <Search className="size-4 shrink-0" aria-hidden />
              <span className="hidden flex-1 text-left sm:inline">Search…</span>
              <ShortcutHint className="hidden rounded border border-border bg-surface px-1.5 font-sans text-[11px] font-medium text-muted-foreground sm:inline" />
            </button>

            <Button asChild className="max-sm:size-9 max-sm:px-0">
              <Link href="/templates/new" aria-label="New template">
                <Plus aria-hidden />
                <span className="hidden sm:inline">New template</span>
              </Link>
            </Button>
          </header>

          {children}
        </div>
      </div>

      <CommandMenu open={searchOpen} onOpenChange={setSearchOpen} tags={tags} />
    </TooltipProvider>
  );
}
