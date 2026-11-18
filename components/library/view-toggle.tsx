import { LayoutGrid, List } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export type LibraryView = "grid" | "list";

/** Segmented Grid / List switch. URL-driven (?view=list) so it survives reloads and back. */
export function ViewToggle({
  view,
  hrefFor,
}: {
  view: LibraryView;
  hrefFor: (v: LibraryView) => string;
}) {
  const items: { value: LibraryView; label: string; icon: typeof List }[] = [
    { value: "grid", label: "Grid", icon: LayoutGrid },
    { value: "list", label: "List", icon: List },
  ];
  return (
    <nav aria-label="Library view" className="inline-flex rounded-lg bg-surface-2 p-0.5">
      {items.map(({ value, label, icon: Icon }) => (
        <Link
          key={value}
          href={hrefFor(value)}
          aria-current={view === value ? "page" : undefined}
          replace
          scroll={false}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
            view === value && "bg-background text-foreground shadow-xs",
          )}
        >
          <Icon className="size-4" aria-hidden />
          <span className="max-sm:sr-only">{label}</span>
        </Link>
      ))}
    </nav>
  );
}
