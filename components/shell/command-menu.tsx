"use client";

import { Plus, Tags, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

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
 * Global ⌘K / Ctrl+K search (DESIGN.md §6). For now it navigates to pages and tags;
 * searching templates, variations and "used in" notes is added in Phase 9.
 */
export function CommandMenu({ open, onOpenChange, tags }: CommandMenuProps) {
  const router = useRouter();

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
    router.push(href);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search"
      description="Jump to a page or tag"
      className="sm:max-w-lg"
    >
      <CommandInput placeholder="Search pages and tags…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
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
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
