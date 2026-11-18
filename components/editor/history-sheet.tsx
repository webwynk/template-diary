"use client";

import { Check, GitCompare, Lock, PencilLine } from "lucide-react";

import { CopyCodeButton } from "@/components/templates/copy-code-button";
import { DownloadButton } from "@/components/templates/download-button";
import { SwatchStrip } from "@/components/templates/swatch-strip";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { HistoryItem } from "@/lib/db/templates";
import type { TemplateKind } from "@/lib/engine/types";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Newest first; the Original (the oldest by definition) last. */
export function historyOrder(items: HistoryItem[]): HistoryItem[] {
  return [...items].sort(
    (a, b) => Number(a.isOriginal) - Number(b.isOriginal) || b.updatedAt.localeCompare(a.updatedAt),
  );
}

/**
 * History sheet (DESIGN.md §7.5): every live variation with its date, colors, parent and change
 * summary. Open loads it as the base (through the unsaved-changes guard); Compare diffs it
 * against the code in the editor right now.
 */
export function HistorySheet({
  open,
  onOpenChange,
  type,
  items,
  baseId,
  now,
  onOpenVariation,
  onCompare,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: TemplateKind;
  items: HistoryItem[];
  baseId: string;
  now: Date;
  onOpenVariation: (id: string) => void;
  onCompare: (id: string) => void;
}) {
  const names = new Map(items.map((v) => [v.id, v.name]));
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:w-[420px] sm:max-w-[420px]">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle>History</SheetTitle>
          <SheetDescription>
            {items.length === 1
              ? "Only the Original so far."
              : `${items.length} versions, newest first.`}
          </SheetDescription>
        </SheetHeader>
        <ol className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {historyOrder(items).map((v, i, list) => {
            const basedOn = v.parentVariationId ? names.get(v.parentVariationId) : undefined;
            const isBase = v.id === baseId;
            return (
              <li key={v.id} className="relative flex gap-3 pb-5 last:pb-1">
                {/* Timeline rail */}
                <div className="flex flex-col items-center pt-1.5" aria-hidden>
                  <span
                    className={cn(
                      "size-2.5 rounded-full border-2",
                      isBase ? "border-primary bg-primary" : "border-border-strong bg-background",
                    )}
                  />
                  {i < list.length - 1 ? <span className="mt-1 w-px flex-1 bg-border" /> : null}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    {v.isOriginal ? (
                      <Lock
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-label="Locked"
                      />
                    ) : null}
                    <p className="min-w-0 truncate font-medium">{v.name}</p>
                    {isBase ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        <Check className="size-3" aria-hidden />
                        Open now
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[13px] text-muted-foreground">
                    {v.isOriginal
                      ? `created ${relativeTime(v.createdAt, now)}`
                      : `updated ${relativeTime(v.updatedAt, now)}`}
                    {basedOn ? ` · based on ${basedOn}` : ""}
                  </p>
                  {v.summary ? <p className="text-[13px]">{v.summary}</p> : null}
                  <SwatchStrip colors={v.swatches} />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {!isBase ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => onOpenVariation(v.id)}
                        aria-label={`Open ${v.name}`}
                      >
                        <PencilLine aria-hidden />
                        Open
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onCompare(v.id)}
                      aria-label={`Compare ${v.name} with current`}
                    >
                      <GitCompare aria-hidden />
                      Compare with current
                    </Button>
                    {type === "custom" ? (
                      <CopyCodeButton variationId={v.id} label="Copy" variant="secondary" />
                    ) : (
                      <DownloadButton variationId={v.id} label="Download" />
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </SheetContent>
    </Sheet>
  );
}
