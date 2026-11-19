"use client";

import { FileCode2, Plus, Search, SlidersHorizontal, Tags, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { searchTemplatesAction, type SearchHit } from "@/actions/library";

import { TagDot } from "@/components/common/tag-dot";
import { MAIN_NAV } from "@/components/shell/nav";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import type { TagWithCount } from "@/lib/tags";

type CommandMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tags: TagWithCount[];
};

/**
 * Global ⌘K / Ctrl+K search (DESIGN.md §6): templates (by name, notes, used in, variation names
 * and tags, the same search as the library), pages and tags.
 */
export function CommandMenu({ open, onOpenChange, tags }: CommandMenuProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<{ q: string; items: SearchHit[] }>({ q: "", items: [] });

  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchTemplatesAction(q)
        .then((r) => !cancelled && r.ok && setHits({ q, items: r.hits }))
        .catch(() => {});
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);
  const q = query.trim();
  const results = q && hits.q === q ? hits.items : [];

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  function go(href: string) {
    onOpenChange(false);
    setQuery("");
    router.push(href);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search"
      description="Search templates, or jump to a page or tag"
      className="sm:max-w-lg"
    >
      <CommandInput
        placeholder="Search templates, pages and tags…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        {q ? (
          <CommandGroup heading="Templates">
            {/* The query is in each value so cmdk's own filter keeps server results. */}
            {results.map((t) => (
              <CommandItem
                key={t.id}
                value={`template ${t.id} ${t.name}`}
                keywords={[q]}
                onSelect={() => go(`/templates/${t.id}`)}
              >
                <FileCode2 className="text-muted-foreground" aria-hidden />
                <span className="truncate">{t.name}</span>
                <span className="ml-auto text-xs text-subtle-foreground">
                  {t.type === "custom" ? "Custom" : "Elementor"}
                </span>
              </CommandItem>
            ))}
            <CommandItem
              value={`search library ${q}`}
              keywords={[q]}
              onSelect={() => go(`/?q=${encodeURIComponent(q)}`)}
            >
              <Search className="text-muted-foreground" aria-hidden />
              Search the library for “{q}”
            </CommandItem>
          </CommandGroup>
        ) : null}
        <CommandGroup heading="Go to">
          {MAIN_NAV.map((item) => (
            <CommandItem key={item.href} value={item.label} onSelect={() => go(item.href)}>
              <item.icon className="text-muted-foreground" aria-hidden />
              {item.label}
            </CommandItem>
          ))}
          <CommandItem value="New template" onSelect={() => go("/templates/new")}>
            <Plus className="text-muted-foreground" aria-hidden />
            New template
          </CommandItem>
        </CommandGroup>
        {tags.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Tags">
              {tags.map((tag) => (
                <CommandItem
                  key={tag.id}
                  value={`tag ${tag.name}`}
                  onSelect={() => go(`/?tag=${tag.id}`)}
                >
                  <TagDot color={tag.color} className="mx-1.5" />
                  {tag.name}
                  <span className="ml-auto text-xs text-subtle-foreground tabular-nums">
                    {tag.templateCount}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}
        <CommandSeparator />
        <CommandGroup heading="Settings">
          <CommandItem value="Settings tags manage" onSelect={() => go("/settings/tags")}>
            <Tags className="text-muted-foreground" aria-hidden />
            Manage tags
          </CommandItem>
          <CommandItem value="Settings account" onSelect={() => go("/settings/account")}>
            <UserRound className="text-muted-foreground" aria-hidden />
            Account
          </CommandItem>
          <CommandItem
            value="Settings preferences defaults"
            onSelect={() => go("/settings/preferences")}
          >
            <SlidersHorizontal className="text-muted-foreground" aria-hidden />
            Preferences
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
