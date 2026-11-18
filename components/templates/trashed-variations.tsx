"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { restoreVariationAction } from "@/actions/variations";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/format";

/** Trashed variations of a template, restorable until the trash is purged (Phase 9). */
export function TrashedVariations({
  items,
  now,
}: {
  items: { id: string; name: string; deletedAt: string }[];
  now: Date;
}) {
  const [restoring, setRestoring] = useState<string | null>(null);

  async function restore(id: string, name: string) {
    setRestoring(id);
    try {
      const result = await restoreVariationAction(id);
      if (result.ok) toast.success(`“${name}” restored`);
      else toast.error(result.error);
    } catch {
      toast.error("Couldn't restore. Check your connection and try again.");
    } finally {
      setRestoring(null);
    }
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
      {items.map((v) => (
        <li key={v.id} className="flex items-center gap-3 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-muted-foreground line-through decoration-border-strong">
              {v.name}
            </p>
            <p className="text-[13px] text-muted-foreground">
              moved to trash {relativeTime(v.deletedAt, now)}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void restore(v.id, v.name)}
            disabled={restoring !== null}
            aria-label={`Restore ${v.name}`}
          >
            {restoring === v.id ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <RotateCcw aria-hidden />
            )}
            Restore
          </Button>
        </li>
      ))}
    </ul>
  );
}
