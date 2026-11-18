"use client";

import { ArrowRight, ChevronDown, RotateCcw } from "lucide-react";
import { useState } from "react";
import { HexAlphaColorPicker, HexColorInput } from "react-colorful";

import { OccurrenceList } from "@/components/editor/palette/occurrence-list";
import type { PaletteProps } from "@/components/editor/palette/types";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { normalizeHex, pendingKey } from "@/lib/editor/session";
import type { ColorFormat, ColorGroup } from "@/lib/engine/types";
import { cn } from "@/lib/utils";

const FORMAT_LABEL: Record<ColorFormat, string> = {
  hex3: "hex",
  hex4: "hex",
  hex6: "hex",
  hex8: "hex",
  rgb: "rgb",
  "rgb-modern": "rgb",
  hsl: "hsl",
  "hsl-modern": "hsl",
  named: "name",
  other: "other",
};

export function Swatch({ color, size = 28 }: { color: string; size?: 16 | 28 }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block shrink-0 border border-border",
        size === 28 ? "size-7 rounded-md" : "size-4 rounded-[4px]",
      )}
      style={{
        backgroundImage: `linear-gradient(${color}, ${color}), conic-gradient(#e2e8f0 25%, #fff 0 50%, #e2e8f0 0 75%, #fff 0)`,
        backgroundSize: "100% 100%, 8px 8px",
      }}
    />
  );
}

/** Colors tab (DESIGN.md §7.5): grouped by value, most used first (the engine sorts them). */
export function ColorRows({ detection, pending, dispatch, onJump }: PaletteProps) {
  if (detection.colors.length === 0) {
    return <EmptyTab text="No colors found in this template." />;
  }
  return (
    <ul className="divide-y divide-border">
      {detection.colors.map((group) => (
        <ColorRow
          key={group.rgb}
          group={group}
          entry={pending.color[pendingKey("color", group.rgb)]}
          dispatch={dispatch}
          onJump={onJump}
        />
      ))}
    </ul>
  );
}

function ColorRow({
  group,
  entry,
  dispatch,
  onJump,
}: {
  group: ColorGroup;
  entry: PaletteProps["pending"]["color"][string] | undefined;
  dispatch: PaletteProps["dispatch"];
  onJump: PaletteProps["onJump"];
}) {
  const [open, setOpen] = useState(false);
  const formats = countFormats(group);
  const varNames = [...new Set(group.occurrences.flatMap((o) => (o.varName ? [o.varName] : [])))];

  return (
    <li>
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <ColorPicker
          from={group.rgb}
          value={entry?.to}
          onChange={(to) => dispatch({ type: "setTarget", kind: "color", from: group.rgb, to })}
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-mono text-xs">
            <span className={cn(entry && "text-muted-foreground line-through")}>{group.rgb}</span>
            {entry ? (
              <>
                <ArrowRight className="size-3 shrink-0 text-muted-foreground" aria-label="to" />
                <Swatch color={entry.to} size={16} />
                <span className="font-medium">{entry.to}</span>
              </>
            ) : null}
          </p>
          <p className="mt-0.5 flex flex-wrap gap-1">
            {formats.map(([label, n]) => (
              <span
                key={label}
                className="rounded bg-surface-2 px-1 font-mono text-[10px] text-muted-foreground"
              >
                {label} ×{n}
              </span>
            ))}
            {varNames.slice(0, 2).map((v) => (
              <span
                key={v}
                className="rounded bg-surface-2 px-1 font-mono text-[10px] text-muted-foreground"
              >
                var({v})
              </span>
            ))}
          </p>
        </div>
        {entry ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Reset ${group.rgb}`}
            title="Reset"
            onClick={() => dispatch({ type: "resetRow", kind: "color", from: group.rgb })}
          >
            <RotateCcw aria-hidden />
          </Button>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={`${open ? "Hide" : "Show"} ${group.count} places using ${group.rgb}`}
          className="flex h-7 items-center gap-0.5 rounded-md px-1.5 text-xs text-muted-foreground tabular-nums hover:bg-surface-2"
        >
          {entry && entry.excludeIds.length > 0
            ? `${group.count - entry.excludeIds.length}/${group.count}`
            : group.count}
          <ChevronDown
            className={cn("size-3.5 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </button>
      </div>
      {open ? (
        <OccurrenceList
          items={group.occurrences.map((o) => ({
            id: o.id,
            location: o.location,
            snippet: o.snippet,
            highlight: o.raw,
            label: o.varName ? `defines ${o.varName}` : undefined,
          }))}
          excluded={entry?.excludeIds}
          onToggle={(id) => dispatch({ type: "toggleExclude", kind: "color", from: group.rgb, id })}
          onJump={onJump}
        />
      ) : null}
    </li>
  );
}

function countFormats(group: ColorGroup): [string, number][] {
  const counts = new Map<string, number>();
  for (const o of group.occurrences) {
    const label = FORMAT_LABEL[o.format];
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts];
}

/** Swatch button with a popover picker. Hex with optional alpha (what the engine accepts). */
function ColorPicker({
  from,
  value,
  onChange,
}: {
  from: string;
  value: string | undefined;
  onChange: (hex: string) => void;
}) {
  const current = value ?? from;
  const set = (raw: string) => {
    const hex = normalizeHex(raw);
    if (hex) onChange(hex);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Change ${from}${value ? `, now ${value}` : ""}`}
          className="rounded-md outline-offset-2"
        >
          <Swatch color={current} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[232px] space-y-3 p-3">
        <HexAlphaColorPicker
          color={current}
          onChange={set}
          style={{ width: "100%", height: 160 }}
        />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Hex
          <HexColorInput
            color={current}
            onChange={set}
            alpha
            prefixed
            aria-label="Hex color"
            className="h-8 min-w-0 flex-1 rounded-md border border-border px-2 font-mono text-xs text-foreground shadow-xs outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/20"
          />
        </label>
        <p className="text-[11px] text-muted-foreground">
          Places that are already transparent keep their own transparency.
        </p>
      </PopoverContent>
    </Popover>
  );
}

export function EmptyTab({ text }: { text: string }) {
  return <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">{text}</p>;
}
