"use client";

import { ArrowRight, ChevronDown, ChevronsUpDown, RotateCcw } from "lucide-react";
import { useState } from "react";

import { EmptyTab } from "@/components/editor/palette/color-rows";
import { OccurrenceList } from "@/components/editor/palette/occurrence-list";
import type { PaletteProps } from "@/components/editor/palette/types";
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
import { pendingKey } from "@/lib/editor/session";
import type { FontKind, FontOccurrence } from "@/lib/engine/types";
import { cn } from "@/lib/utils";
import { fontNameSchema } from "@/lib/validation/swaps";

/** Popular Google Fonts, offered as suggestions; any valid family name can be typed. */
export const FONT_SUGGESTIONS = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Source Sans 3",
  "Raleway",
  "Nunito",
  "Nunito Sans",
  "Work Sans",
  "DM Sans",
  "Manrope",
  "Plus Jakarta Sans",
  "Outfit",
  "Rubik",
  "Mulish",
  "Barlow",
  "Figtree",
  "Space Grotesk",
  "Sora",
  "Urbanist",
  "Lexend",
  "IBM Plex Sans",
  "Playfair Display",
  "Merriweather",
  "Lora",
  "PT Serif",
  "Libre Baskerville",
  "DM Serif Display",
  "Cormorant Garamond",
  "Oswald",
  "Bebas Neue",
  "Archivo",
  "Josefin Sans",
  "Quicksand",
  "Karla",
  "Fira Sans",
  "JetBrains Mono",
  "Space Mono",
];

const KIND_LABEL: Record<FontKind, string> = {
  "font-family": "font-family",
  "google-fonts-link": "Google Fonts link",
  "css-import": "@import",
  "elementor-typography": "Elementor typography",
};

interface FontGroup {
  family: string;
  occurrences: FontOccurrence[];
}

function groupFonts(fonts: FontOccurrence[]): FontGroup[] {
  const map = new Map<string, FontGroup>();
  for (const f of fonts) {
    const key = f.family.toLowerCase();
    const group = map.get(key) ?? { family: f.family, occurrences: [] };
    group.occurrences.push(f);
    map.set(key, group);
  }
  return [...map.values()].sort((a, b) => b.occurrences.length - a.occurrences.length);
}

/** Fonts tab (DESIGN.md §7.5): names in Inter (no font loading), replace via a combobox. */
export function FontRows({ detection, pending, dispatch, onJump }: PaletteProps) {
  const groups = groupFonts(detection.fonts);
  if (groups.length === 0) return <EmptyTab text="No fonts found in this template." />;
  return (
    <ul className="divide-y divide-border">
      {groups.map((group) => (
        <FontRow
          key={group.family.toLowerCase()}
          group={group}
          entry={pending.font[pendingKey("font", group.family)]}
          dispatch={dispatch}
          onJump={onJump}
        />
      ))}
    </ul>
  );
}

function FontRow({
  group,
  entry,
  dispatch,
  onJump,
}: {
  group: FontGroup;
  entry: PaletteProps["pending"]["font"][string] | undefined;
  dispatch: PaletteProps["dispatch"];
  onJump: PaletteProps["onJump"];
}) {
  const [open, setOpen] = useState(false);
  const count = group.occurrences.length;
  const kinds = [...new Set(group.occurrences.map((o) => KIND_LABEL[o.kind]))];
  const hasGoogleLink = group.occurrences.some((o) => o.kind === "google-fonts-link");

  return (
    <li>
      <div className="space-y-2 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[13px] font-medium">
              <span className={cn("truncate", entry && "text-muted-foreground line-through")}>
                {group.family}
              </span>
              {entry ? (
                <>
                  <ArrowRight className="size-3 shrink-0 text-muted-foreground" aria-label="to" />
                  <span className="truncate">{entry.to}</span>
                </>
              ) : null}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">{kinds.join(" · ")}</p>
          </div>
          {entry ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Reset ${group.family}`}
              title="Reset"
              onClick={() => dispatch({ type: "resetRow", kind: "font", from: group.family })}
            >
              <RotateCcw aria-hidden />
            </Button>
          ) : null}
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={`${open ? "Hide" : "Show"} ${count} places using ${group.family}`}
            className="flex h-7 items-center gap-0.5 rounded-md px-1.5 text-xs text-muted-foreground tabular-nums hover:bg-surface-2"
          >
            {entry && entry.excludeIds.length > 0
              ? `${count - entry.excludeIds.length}/${count}`
              : count}
            <ChevronDown
              className={cn("size-3.5 transition-transform", open && "rotate-180")}
              aria-hidden
            />
          </button>
        </div>
        <FontCombobox
          from={group.family}
          value={entry?.to}
          onPick={(to) => dispatch({ type: "setTarget", kind: "font", from: group.family, to })}
        />
        {entry && hasGoogleLink ? (
          <p className="text-[11px] text-muted-foreground">The Google Fonts link is updated too.</p>
        ) : null}
      </div>
      {open ? (
        <OccurrenceList
          items={group.occurrences.map((o) => ({
            id: o.id,
            location: o.location,
            snippet: o.snippet,
            highlight: o.raw,
            label: KIND_LABEL[o.kind],
          }))}
          excluded={entry?.excludeIds}
          onToggle={(id) =>
            dispatch({ type: "toggleExclude", kind: "font", from: group.family, id })
          }
          onJump={onJump}
        />
      ) : null}
    </li>
  );
}

function FontCombobox({
  from,
  value,
  onPick,
}: {
  from: string;
  value: string | undefined;
  onPick: (family: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const typed = fontNameSchema.safeParse(query);
  const q = query.trim().toLowerCase();
  const exact = FONT_SUGGESTIONS.some((f) => f.toLowerCase() === q);

  function pick(family: string) {
    onPick(family);
    setOpen(false);
    setQuery("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          role="combobox"
          aria-expanded={open}
          aria-label={`Replace font ${from}`}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value ?? "Replace with…"}
          </span>
          <ChevronsUpDown className="text-muted-foreground" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-[240px] p-0"
      >
        <Command>
          <CommandInput placeholder="Font name…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>
              {q && !typed.success ? typed.error.issues[0]?.message : "No suggestions."}
            </CommandEmpty>
            {q && typed.success && !exact ? (
              <CommandGroup>
                <CommandItem value={`use:${typed.data}`} onSelect={() => pick(typed.data)}>
                  Use &ldquo;{typed.data}&rdquo;
                </CommandItem>
              </CommandGroup>
            ) : null}
            <CommandGroup heading="Google Fonts">
              {FONT_SUGGESTIONS.map((family) => (
                <CommandItem key={family} value={family} onSelect={() => pick(family)}>
                  {family}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
