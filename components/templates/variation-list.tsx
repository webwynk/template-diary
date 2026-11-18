import { Lock, PencilLine } from "lucide-react";
import Link from "next/link";

import { CopyCodeButton } from "@/components/templates/copy-code-button";
import { DownloadButton } from "@/components/templates/download-button";
import { SwatchStrip } from "@/components/templates/swatch-strip";
import { Button } from "@/components/ui/button";
import type { VariationListItem } from "@/lib/db/templates";
import type { TemplateKind } from "@/lib/engine/types";
import { relativeTime, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Variations of a template (DESIGN.md §7.4). The Original is first, locked and has no rename or
 * trash actions. "Open" starts the editor from that variation; rename/trash come with Phase 7.
 */
export function VariationList({
  templateId,
  variations,
  type,
  now,
}: {
  templateId: string;
  variations: VariationListItem[];
  type: TemplateKind;
  now: Date;
}) {
  const names = new Map(variations.map((v) => [v.id, v.name]));
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
      {variations.map((v) => {
        const basedOn = v.parentVariationId ? names.get(v.parentVariationId) : undefined;
        return (
          <li
            key={v.id}
            className={cn(
              "flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3",
              v.isOriginal && "bg-surface",
            )}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <SwatchStrip colors={v.swatches} />
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate font-medium">
                  {v.isOriginal ? (
                    <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-label="Locked" />
                  ) : null}
                  <span className="truncate">{v.name}</span>
                </p>
                <p className="text-[13px] text-muted-foreground">
                  {v.isOriginal
                    ? `created ${shortDate(v.createdAt, now)}`
                    : `updated ${relativeTime(v.updatedAt, now)}`}
                  {basedOn ? ` · based on ${basedOn}` : ""}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link
                  href={`/templates/${templateId}/edit?base=${v.id}`}
                  aria-label={`Open ${v.name} in the editor`}
                >
                  <PencilLine aria-hidden />
                  Open
                </Link>
              </Button>
              {type === "custom" ? (
                <CopyCodeButton variationId={v.id} label="Copy" />
              ) : (
                <DownloadButton variationId={v.id} label="Download" />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
