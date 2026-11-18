import { Lock, PencilLine } from "lucide-react";
import Link from "next/link";

import { CopyCodeButton } from "@/components/templates/copy-code-button";
import { DownloadButton } from "@/components/templates/download-button";
import { SwatchStrip } from "@/components/templates/swatch-strip";
import { VariationActions } from "@/components/templates/variation-actions";
import { Button } from "@/components/ui/button";
import type { VariationListItem } from "@/lib/db/templates";
import type { TemplateKind } from "@/lib/engine/types";
import { relativeTime, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Variations of a template (DESIGN.md §7.4). The Original is first, locked and has no rename or
 * trash actions. "Open"/"Edit" starts the editor from that variation; ⋯ holds the rest.
 */
export function VariationList({
  templateId,
  templateName,
  variations,
  trashed,
  type,
  now,
}: {
  templateId: string;
  templateName: string;
  variations: VariationListItem[];
  /** Trashed variations, so "based on" still names a parent that was moved to the trash. */
  trashed: { id: string; name: string }[];
  type: TemplateKind;
  now: Date;
}) {
  const names = new Map([
    ...trashed.map((v) => [v.id, `${v.name} (in trash)`] as const),
    ...variations.map((v) => [v.id, v.name] as const),
  ]);
  const compareOptions = variations.map((v) => ({ id: v.id, name: v.name }));
  const originalId = variations.find((v) => v.isOriginal)?.id;
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
            <div className="flex min-w-0 flex-[1_1_16rem] items-center gap-3">
              {v.featureImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- short-lived signed Storage URL
                <img
                  src={v.featureImageUrl}
                  alt=""
                  loading="lazy"
                  className="hidden aspect-[16/10] w-16 shrink-0 rounded-md border border-border object-cover object-top sm:block"
                />
              ) : null}
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
                  {v.summary ? ` · ${v.summary}` : ""}
                </p>
                {v.usedIn ? (
                  <p className="truncate text-[13px]">
                    <span className="text-muted-foreground">Used in: </span>
                    {v.usedIn}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link
                  href={`/templates/${templateId}/edit?base=${v.id}`}
                  aria-label={
                    v.isOriginal
                      ? `Open ${v.name} in the editor (locked, saves as a new variation)`
                      : `Edit ${v.name}`
                  }
                >
                  <PencilLine aria-hidden />
                  {v.isOriginal ? "Open" : "Edit"}
                </Link>
              </Button>
              {type === "custom" ? (
                <CopyCodeButton variationId={v.id} label="Copy" />
              ) : (
                <DownloadButton variationId={v.id} label="Download" />
              )}
              <VariationActions
                templateName={templateName}
                type={type}
                variation={v}
                compareOptions={compareOptions}
                originalId={originalId}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
