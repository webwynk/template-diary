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
  setFavoriteAction,
  trashTemplateAction,
} from "@/actions/library";
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

  async function favorite() {
    const r = await setFavoriteAction(id, !isFavorite);
    if (!r.ok) toast.error(r.error);
  }

  async function trash() {
    const r = await trashTemplateAction(id);
    if (!r.ok) return void toast.error(r.error);
    toast.success(`“${name}” moved to the trash`, {
      action: {
        label: "Undo",
        onClick: () => {
          void restoreTemplateAction(id).then((res) => {
            if (!res.ok) toast.error(res.error);
            else if (afterTrash) router.push(`/templates/${id}`);
          });
        },
      },
    });
    if (afterTrash) router.push(afterTrash);
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
          <DropdownMenuItem onSelect={() => void favorite()}>
            {isFavorite ? <StarOff aria-hidden /> : <Star aria-hidden />}
            {isFavorite ? "Remove from favorites" : "Add to favorites"}
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
