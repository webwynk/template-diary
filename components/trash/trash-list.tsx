"use client";

import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { deleteForeverAction, emptyTrashAction, restoreTemplateAction } from "@/actions/library";
import { restoreVariationAction } from "@/actions/variations";
import { EmptyState } from "@/components/common/empty-state";
import { TemplateThumb } from "@/components/templates/template-thumb";
import { TypeBadge } from "@/components/templates/type-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { TrashEntry } from "@/lib/db/library";
import { plural, relativeTime } from "@/lib/format";

type Confirm = { kind: "one"; entry: TrashEntry } | { kind: "all" } | null;

/** Trash (DESIGN.md §7.7): restore, delete permanently (confirm names the item), empty trash. */
export function TrashList({ entries, now }: { entries: TrashEntry[]; now: Date }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  async function run(
    key: string,
    action: () => Promise<{ ok: boolean; error?: string }>,
    ok: string,
  ) {
    setBusy(key);
    try {
      const r = await action();
      if (r.ok) toast.success(ok);
      else toast.error(r.error ?? "Something went wrong. Please try again.");
    } catch {
      toast.error("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  const restore = (e: TrashEntry) =>
    run(
      e.id,
      () => (e.kind === "template" ? restoreTemplateAction(e.id) : restoreVariationAction(e.id)),
      `“${e.name}” restored`,
    );

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={Trash2}
        title="Trash is empty"
        description="Deleted templates and variations stay here until you restore them or delete them permanently."
      />
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {plural(entries.length, "item")} · kept until you delete them
        </p>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={busy !== null}
          onClick={() => setConfirm({ kind: "all" })}
        >
          {busy === "all" ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Trash2 aria-hidden />
          )}
          Empty trash
        </Button>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {entries.map((e) => (
          <li
            key={`${e.kind}-${e.id}`}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
          >
            <div className="flex min-w-0 flex-[1_1_16rem] items-center gap-3">
              <TemplateThumb
                name={e.template?.name ?? e.name}
                type={e.type}
                src={e.imageUrl}
                size="sm"
                className="hidden w-16 shrink-0 rounded-md border border-border sm:block"
              />
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate font-medium">
                  <span className="truncate">{e.name}</span>
                  {e.kind === "template" ? <TypeBadge type={e.type} /> : null}
                </p>
                <p className="truncate text-[13px] text-muted-foreground">
                  {e.kind === "variation" && e.template ? (
                    <>
                      Variation of{" "}
                      <Link
                        href={`/templates/${e.template.id}`}
                        className="text-foreground hover:underline"
                      >
                        {e.template.name}
                      </Link>{" "}
                      ·{" "}
                    </>
                  ) : null}
                  deleted {relativeTime(e.deletedAt, now)}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy !== null}
                onClick={() => void restore(e)}
                aria-label={`Restore ${e.name}`}
              >
                {busy === e.id ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <RotateCcw aria-hidden />
                )}
                Restore
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy !== null}
                onClick={() => setConfirm({ kind: "one", entry: e })}
                aria-label={`Delete ${e.name} permanently`}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 aria-hidden />
                <span className="hidden sm:inline">Delete permanently</span>
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "one"
                ? `Delete “${confirm.entry.name}” permanently?`
                : `Empty the trash (${plural(entries.length, "item")})?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "one" && confirm.entry.kind === "template"
                ? "The template, all of its variations and its images are deleted for good. This can't be undone."
                : confirm?.kind === "one"
                  ? "The variation and its image are deleted for good. This can't be undone."
                  : "Everything in the trash, with its images, is deleted for good. This can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (confirm?.kind === "one") {
                  const { entry } = confirm;
                  void run(
                    entry.id,
                    () => deleteForeverAction({ kind: entry.kind, id: entry.id }),
                    `“${entry.name}” deleted permanently`,
                  );
                } else if (confirm?.kind === "all") {
                  void run("all", () => emptyTrashAction(), "Trash emptied");
                }
              }}
            >
              {confirm?.kind === "one" ? "Delete permanently" : "Empty trash"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
