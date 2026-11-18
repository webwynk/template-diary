"use client";

import { ArrowDownUp, Check, ChevronDown, Loader2, Search, Star, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { TagDot } from "@/components/common/tag-dot";
import type { TagRef } from "@/components/templates/tag-pills";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  filtersHref,
  type LibraryFilters,
  type LibrarySort,
  SORT_LABELS,
} from "@/lib/library/filters";
import { cn } from "@/lib/utils";

const TYPE_LABELS = { custom: "Custom", elementor: "Elementor" } as const;

/**
 * Library search and filters (DESIGN.md §7.2). Everything lives in the URL, so a filtered view
 * can be bookmarked and Back works; typing replaces the URL (no history entry per key).
 */
export function LibraryToolbar({
  filters,
  tags,
  base,
}: {
  filters: LibraryFilters;
  tags: TagRef[];
  base: "/" | "/favorites";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(filters.q);

  // Follow the URL when it changes from outside (Back, a chip, Clear all).
  const [seenQ, setSeenQ] = useState(filters.q);
  if (filters.q !== seenQ) {
    setSeenQ(filters.q);
    setQ(filters.q);
  }

  useEffect(() => {
    const value = q.trim();
    if (value === filters.q) return;
    const timer = setTimeout(() => {
      startTransition(() =>
        router.replace(filtersHref(filters, { q: value }, base), { scroll: false }),
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [q, filters, base, router]);

  const go = (patch: Partial<LibraryFilters>) =>
    startTransition(() =>
      router.push(filtersHref(filters, { ...patch, q: q.trim() }, base), { scroll: false }),
    );

  const activeTag = tags.find((t) => t.id === filters.tag);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-[1_1_260px]">
        {pending ? (
          <Loader2
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden
          />
        ) : (
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
        )}
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && q) {
              e.preventDefault();
              setQ("");
            }
          }}
          placeholder="Search names, notes, used in, variations, tags…"
          aria-label="Search templates"
          maxLength={200}
          className="pr-8 pl-9"
        />
        {q ? (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="Clear search"
            className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-surface-2 hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>

      <FilterMenu
        label={filters.type ? TYPE_LABELS[filters.type] : "Type"}
        active={filters.type !== null}
        ariaLabel="Filter by type"
      >
        <Choice selected={!filters.type} onSelect={() => go({ type: null })}>
          All types
        </Choice>
        {(["custom", "elementor"] as const).map((t) => (
          <Choice key={t} selected={filters.type === t} onSelect={() => go({ type: t })}>
            {TYPE_LABELS[t]}
          </Choice>
        ))}
      </FilterMenu>

      <FilterMenu
        label={activeTag ? activeTag.name : "Tag"}
        active={Boolean(activeTag)}
        ariaLabel="Filter by tag"
        disabled={tags.length === 0}
      >
        <Choice selected={!filters.tag} onSelect={() => go({ tag: null })}>
          All tags
        </Choice>
        {tags.map((t) => (
          <Choice key={t.id} selected={filters.tag === t.id} onSelect={() => go({ tag: t.id })}>
            <TagDot color={t.color} />
            <span className="truncate">{t.name}</span>
          </Choice>
        ))}
      </FilterMenu>

      {base === "/" ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          aria-pressed={filters.fav}
          onClick={() => go({ fav: !filters.fav })}
          className={cn("h-9", filters.fav && "border-[#F59E0B]/50 bg-[#FFFBEB]")}
        >
          <Star className={cn(filters.fav && "fill-[#F59E0B] text-[#F59E0B]")} aria-hidden />
          Favorites
        </Button>
      ) : null}

      <FilterMenu label={SORT_LABELS[filters.sort]} icon ariaLabel="Sort">
        {(Object.keys(SORT_LABELS) as LibrarySort[]).map((s) => (
          <Choice key={s} selected={filters.sort === s} onSelect={() => go({ sort: s })}>
            {SORT_LABELS[s]}
          </Choice>
        ))}
      </FilterMenu>
    </div>
  );
}

function FilterMenu({
  label,
  active = false,
  icon = false,
  ariaLabel,
  disabled,
  children,
}: {
  label: string;
  active?: boolean;
  icon?: boolean;
  ariaLabel: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled}
          aria-label={`${ariaLabel}: ${label}`}
          className={cn(
            "h-9 max-w-[200px]",
            active && "border-primary/40 bg-primary/5 text-primary",
          )}
        >
          {icon ? <ArrowDownUp aria-hidden /> : null}
          <span className="truncate">{label}</span>
          <ChevronDown className="text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[320px] w-52 overflow-y-auto">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Choice({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenuItem onSelect={onSelect} aria-checked={selected} role="menuitemradio">
      <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
      {selected ? <Check className="text-primary" aria-hidden /> : null}
    </DropdownMenuItem>
  );
}
