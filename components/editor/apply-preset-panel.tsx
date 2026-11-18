"use client";

import { AlertCircle, ArrowRight, Loader2, Palette } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useState } from "react";

import { countPresetUseAction, listPresetsAction } from "@/actions/presets";
import { Swatch } from "@/components/editor/palette/color-rows";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { EditorAction, PendingEntry } from "@/lib/editor/session";
import type { ColorGroup } from "@/lib/engine/types";
import { plural } from "@/lib/format";
import { type Preset, suggestMapping } from "@/lib/presets";

type Mapping = Record<string, string | null>;

/** The color rows for a mapping: mapped colors change, "Keep" leaves the row as it was. */
export function mappedColors(
  snapshot: Record<string, PendingEntry>,
  mapping: Mapping,
): Record<string, PendingEntry> {
  const out = { ...snapshot };
  for (const [rgb, hex] of Object.entries(mapping)) {
    if (!hex) continue;
    out[rgb] = { from: rgb, to: hex, excludeIds: snapshot[rgb]?.excludeIds ?? [] };
  }
  return out;
}

/**
 * Apply preset (DESIGN.md §7.5 "Preset mapping dialog"). A side panel without a backdrop, so the
 * live preview stays visible and updates while mapping: every change is applied to the editor
 * right away, Cancel puts the colors back exactly as they were, Apply keeps them (still unsaved,
 * like any palette change) and counts one use of the palette.
 */
export function ApplyPresetPanel({
  open,
  onOpenChange,
  colors,
  pendingColors,
  dispatch,
  onApplied,
  loadPresets = listPresetsAction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Detected colors, most used first. */
  colors: ColorGroup[];
  pendingColors: Record<string, PendingEntry>;
  dispatch: (action: EditorAction) => void;
  onApplied: (presetName: string) => void;
  /** Defaults to the server action; replaceable for previews. */
  loadPresets?: typeof listPresetsAction;
}) {
  const selectId = useId();
  const [snapshot] = useState(pendingColors);
  const [presets, setPresets] = useState<Preset[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [presetId, setPresetId] = useState<string>("");
  const [mapping, setMapping] = useState<Mapping>({});

  useEffect(() => {
    let cancelled = false;
    loadPresets()
      .then((r) => {
        if (cancelled) return;
        if (r.ok) setPresets([...r.presets].sort((a, b) => b.useCount - a.useCount));
        else setLoadError(r.error);
      })
      .catch(() => !cancelled && setLoadError("Couldn't load your palettes. Try again."));
    return () => {
      cancelled = true;
    };
  }, [loadPresets]);

  const preset = presets?.find((p) => p.id === presetId);

  function changeMapping(next: Mapping) {
    setMapping(next);
    dispatch({ type: "setColors", color: mappedColors(snapshot, next) });
  }

  function choosePreset(id: string) {
    setPresetId(id);
    const chosen = presets?.find((p) => p.id === id);
    changeMapping(
      chosen
        ? suggestMapping(
            colors.map((c) => c.rgb),
            chosen.colors,
          )
        : {},
    );
  }

  function cancel() {
    dispatch({ type: "setColors", color: snapshot });
    onOpenChange(false);
  }

  function apply() {
    if (!preset) return;
    void countPresetUseAction(preset.id);
    onApplied(preset.name);
    onOpenChange(false);
  }

  const changed = Object.values(mapping).filter(Boolean).length;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : cancel())}
      modal={false}
    >
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:w-[400px] sm:max-w-[400px]"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle>Apply preset</SheetTitle>
          <SheetDescription>
            Pick a palette, then choose a new color for each color in this template. The preview
            updates as you go.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loadError ? (
            <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {loadError}
            </p>
          ) : presets === null ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Loading palettes…
            </p>
          ) : presets.length === 0 ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                You have no palettes yet. Use “Save as preset” to keep this template&apos;s colors,
                or make one on the Palettes page.
              </p>
              <Button asChild variant="secondary" size="sm">
                <Link href="/palettes" target="_blank">
                  <Palette aria-hidden />
                  Open Palettes
                </Link>
              </Button>
            </div>
          ) : colors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No colors found in this template.</p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor={selectId} className="text-sm font-medium">
                  Palette
                </label>
                <select
                  id={selectId}
                  value={presetId}
                  onChange={(e) => choosePreset(e.target.value)}
                  className={SELECT}
                >
                  <option value="">Choose a palette…</option>
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({plural(p.colors.length, "color")})
                    </option>
                  ))}
                </select>
              </div>

              {preset ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Template color (most used first)</span>
                    <button
                      type="button"
                      className="font-medium text-primary hover:underline"
                      onClick={() =>
                        changeMapping(
                          suggestMapping(
                            colors.map((c) => c.rgb),
                            preset.colors,
                          ),
                        )
                      }
                    >
                      Suggest again
                    </button>
                  </div>
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {colors.map((group) => {
                      const target = mapping[group.rgb] ?? null;
                      const current = snapshot[group.rgb]?.to;
                      return (
                        <li key={group.rgb} className="flex items-center gap-2 px-2.5 py-2">
                          <Swatch color={current ?? group.rgb} />
                          <span className="w-[76px] shrink-0 font-mono text-xs">
                            {current ?? group.rgb}
                            <span className="block text-[10px] text-muted-foreground">
                              ×{group.count}
                            </span>
                          </span>
                          <ArrowRight
                            className="size-3.5 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                          <Swatch color={target ?? current ?? group.rgb} />
                          <select
                            value={target ?? ""}
                            aria-label={`New color for ${group.rgb}`}
                            onChange={(e) =>
                              changeMapping({ ...mapping, [group.rgb]: e.target.value || null })
                            }
                            className={`${SELECT} h-8 min-w-0 flex-1 font-mono text-xs md:text-xs`}
                          >
                            <option value="">Keep</option>
                            {preset.colors.map((c, i) => (
                              <option key={`${c.hex}-${i}`} value={c.hex}>
                                {c.label ? `${c.label} · ${c.hex}` : c.hex}
                              </option>
                            ))}
                          </select>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t border-border px-5 py-3">
          <Button type="button" variant="secondary" onClick={cancel}>
            Cancel
          </Button>
          <Button type="button" onClick={apply} disabled={!preset || changed === 0}>
            Apply mapping
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

const SELECT =
  "h-9 w-full rounded-md border border-input bg-background px-2.5 text-base shadow-xs outline-none hover:border-border-strong focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/20 md:text-sm";
