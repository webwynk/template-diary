"use client";

import {
  Copy,
  ExternalLink,
  MoreHorizontal,
  PencilLine,
  Star,
  StarOff,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  duplicateTemplateAction,
  restoreTemplateAction,
  trashTemplateAction,
} from "@/actions/library";
import { saveFavorite } from "@/components/library/favorite-button";
import { EditDetailsDialog, type EditableDetails } from "@/components/library/edit-details-dialog";
import type { TagRef } from "@/components/templates/tag-pills";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { requestScreenshot } from "@/lib/images/prepare";
import {
  clearOverride,
  setOverride,
  settleOverride,
  useTemplateOverride,
} from "@/lib/library/optimistic";
import { cn } from "@/lib/utils";

export function copyName(name: string): string {
  return `${name.length > 115 ? name.slice(0, 115).trimEnd() : name} copy`;
}

/**
 * Template ⋯ menu (DESIGN.md §7.2): Open, Duplicate, Edit details, Add to / Remove from
 * favorites, Move to trash (with Undo). Used on cards, list rows and the template page.
 */
export function TemplateMenu({
  template,
  isFavorite,
  tags,
  showOpen = true,
  afterTrash,
  className,
}: {
  template: EditableDetails;
  isFavorite: boolean;
  tags: TagRef[];
  showOpen?: boolean;
  /** Where to go after moving to the trash (the template page itself is gone then). */
  afterTrash?: string;
  className?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const { id, name } = template;
  const favoriteNow = useTemplateOverride(id)?.favorite ?? isFavorite;

  async function duplicate() {
    const r = await duplicateTemplateAction(id, copyName(name));
    if (!r.ok) return void toast.error(r.error);
    if (r.type === "custom") {
      // Feature images aren't copied; render one for the copy in the background.
      void requestScreenshot({ templateId: r.id, replace: false }).then((s) => {
        if (s.ok) router.refresh();
      });
    }
    toast.success(`Duplicated as “${copyName(name)}”`, {
      action: { label: "Open", onClick: () => router.push(`/templates/${r.id}`) },
    });
  }

  async function trash() {
    // The card disappears and the toast shows at once; saving happens behind them.
    setOverride(id, { trashed: true });
    if (afterTrash) router.push(afterTrash);
    const toastId = toast.success(`“${name}” moved to the trash`, {
      action: {
        label: "Undo",
        onClick: () => {
          clearOverride(id, "trashed");
          void restoreTemplateAction(id).then((res) => {
            if (!res.ok) toast.error(res.error);
            else if (afterTrash) router.push(`/templates/${id}`);
          });
        },
      },
    });
    try {
      const r = await trashTemplateAction(id);
      if (!r.ok) {
        clearOverride(id, "trashed");
        toast.dismiss(toastId);
        toast.error(r.error);
        if (afterTrash) router.push(`/templates/${id}`);
        return;
      }
      settleOverride(id, "trashed");
    } catch {
      clearOverride(id, "trashed");
      toast.dismiss(toastId);
      toast.error("Couldn't move it to the trash. Check your connection and try again.");
      if (afterTrash) router.push(`/templates/${id}`);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`More actions for ${name}`}
            className={cn("relative z-10", className)}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {showOpen ? (
            <DropdownMenuItem asChild>
              <Link href={`/templates/${id}`}>
                <ExternalLink aria-hidden />
                Open
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => void duplicate()}>
            <Copy aria-hidden />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <PencilLine aria-hidden />
            Edit details
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void saveFavorite(id, !favoriteNow)}>
            {favoriteNow ? <StarOff aria-hidden /> : <Star aria-hidden />}
            {favoriteNow ? "Remove from favorites" : "Add to favorites"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => void trash()}>
            <Trash2 aria-hidden />
            Move to trash
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {editing ? (
        <EditDetailsDialog open onOpenChange={setEditing} template={template} tags={tags} />
      ) : null}
    </>
  );
}
