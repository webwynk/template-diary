"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useState } from "react";

import { ColorRows } from "@/components/editor/palette/color-rows";
import { FontRows } from "@/components/editor/palette/font-rows";
import { ImageGrid } from "@/components/editor/palette/image-grid";
import type { PaletteProps } from "@/components/editor/palette/types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type PaletteTab = "colors" | "images" | "fonts";

/** Palette (DESIGN.md §7.5): Colors · Images · Fonts, plus Reset all. */
export function PalettePanel({
  canReset,
  onResetAll,
  ...props
}: PaletteProps & { canReset: boolean; onResetAll: () => void }) {
  const [tab, setTab] = useState<PaletteTab>("colors");
  const { detection } = props;
  const counts = {
    colors: detection.colors.length,
    images: new Set(detection.images.map((i) => i.url)).size,
    fonts: new Set(detection.fonts.map((f) => f.family.toLowerCase())).size,
  };

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as PaletteTab)}
      className="flex h-full min-w-0 flex-col gap-0 bg-background"
      aria-label="Palette"
    >
      <div className="flex h-11 shrink-0 items-center border-b border-border px-3">
        <TabsList variant="line" aria-label="Palette sections">
          {(["colors", "images", "fonts"] as const).map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">
              {t}{" "}
              <span className="text-xs font-normal text-muted-foreground tabular-nums">
                {counts[t]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {detection.warnings.length > 0 ? (
        <details className="shrink-0 border-b border-border bg-warning-soft px-3 py-2 text-[12px] text-warning">
          <summary className="flex cursor-pointer items-center gap-1.5 font-medium">
            <AlertTriangle className="size-3.5" aria-hidden />
            {detection.warnings.length === 1
              ? "1 note about this template"
              : `${detection.warnings.length} notes about this template`}
          </summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {detection.warnings.slice(0, 20).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      ) : null}
      <TabsContent value="colors" className="min-h-0 overflow-y-auto">
        <ColorRows {...props} />
      </TabsContent>
      <TabsContent value="images" className="min-h-0 overflow-y-auto">
        <ImageGrid {...props} />
      </TabsContent>
      <TabsContent value="fonts" className="min-h-0 overflow-y-auto">
        <FontRows {...props} />
      </TabsContent>
      <div className="flex shrink-0 items-center justify-end border-t border-border px-3 py-2">
        <Button type="button" variant="ghost" size="sm" disabled={!canReset} onClick={onResetAll}>
          <RotateCcw aria-hidden />
          Reset all
        </Button>
      </div>
    </Tabs>
  );
}
