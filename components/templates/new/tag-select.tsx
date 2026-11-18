"use client";

import { Check, ChevronsUpDown, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { TagDot } from "@/components/common/tag-dot";
import type { TagRef } from "@/components/templates/tag-pills";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Multi-select combobox for tags (DESIGN.md §7.3): colored dot + name, "Manage tags" link. */
export function TagSelect({
  id,
  tags,
  value,
  onChange,
  disabled,
}: {
  id: string;
  tags: TagRef[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = tags.filter((t) => value.includes(t.id));

  const toggle = (tagId: string) =>
    onChange(value.includes(tagId) ? value.filter((v) => v !== tagId) : [...value, tagId]);

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="secondary"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || tags.length === 0}
            className="w-full justify-between font-normal"
          >
            <span className={cn(selected.length === 0 && "text-muted-foreground")}>
              {tags.length === 0
                ? "No tags yet"
                : selected.length === 0
                  ? "Choose tags"
                  : `${selected.length} selected`}
            </span>
            <ChevronsUpDown className="text-muted-foreground" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command>
            <CommandInput placeholder="Search tags…" />
            <CommandList>
              <CommandEmpty>No tags found.</CommandEmpty>
              <CommandGroup>
                {tags.map((tag) => {
                  const on = value.includes(tag.id);
                  return (
                    <CommandItem
                      key={tag.id}
                      value={`${tag.name} ${tag.id}`}
                      onSelect={() => toggle(tag.id)}
                    >
                      <span
                        className={cn(
                          "flex size-4 items-center justify-center rounded-[4px] border",
                          on
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border-strong",
                        )}
                        aria-hidden
                      >
                        {on ? <Check className="size-3 text-primary-foreground" /> : null}
                      </span>
                      <TagDot color={tag.color} />
                      <span className="truncate">{tag.name}</span>
                      <span className="sr-only">{on ? "(selected)" : ""}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Selected tags">
          {selected.map((tag) => (
            <li
              key={tag.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 py-0.5 pr-1 pl-2 text-xs font-medium"
            >
              <TagDot color={tag.color} />
              {tag.name}
              <button
                type="button"
                onClick={() => toggle(tag.id)}
                disabled={disabled}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-border hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                aria-label={`Remove tag ${tag.name}`}
              >
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-[13px] text-muted-foreground">
        <Link href="/settings/tags" className="font-medium text-primary hover:underline">
          Manage tags
        </Link>
      </p>
    </div>
  );
}
