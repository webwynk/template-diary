"use client";

import { Copy, GitCompare, MoreHorizontal, NotebookPen, PencilLine, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  duplicateAsTemplateAction,
  renameVariationAction,
  restoreVariationAction,
  setVariationUsedInAction,
  trashVariationAction,
} from "@/actions/variations";
import { CompareDialog, type CompareOption } from "@/components/templates/compare-dialog";
import { TextFieldDialog } from "@/components/templates/text-field-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TemplateKind } from "@/lib/engine/types";
import { requestScreenshot } from "@/lib/images/prepare";

type Open = "rename" | "usedIn" | "duplicate" | "compare" | null;

/** Default name for "Duplicate as new template", within the 120-character limit. */
export function duplicateName(templateName: string, variationName: string, isOriginal: boolean) {
  const name = isOriginal ? `${templateName} copy` : `${templateName} – ${variationName}`;
  return name.length > 120 ? `${name.slice(0, 119)}…` : name;
}

/**
 * The ⋯ menu of a variation row (DEVELOPMENT.md Phase 7). The Original has no Rename or
 * Move to trash; the server and the database refuse both anyway.
 */
export function VariationActions({
  templateName,
  type,
  variation,
  compareOptions,
  originalId,
}: {
  templateName: string;
  type: TemplateKind;
  variation: { id: string; name: string; isOriginal: boolean; usedIn: string | null };
  compareOptions: CompareOption[];
  originalId: string | undefined;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<Open>(null);
  const close = (next: boolean) => !next && setOpen(null);
  const { id, name, isOriginal } = variation;

  async function trash() {
    const result = await trashVariationAction(id);
    if (!result.ok) return void toast.error(result.error);
    toast.success(`“${name}” moved to the trash`, {
      action: {
        label: "Undo",
        onClick: () => {
          void restoreVariationAction(id).then((r) => {
            if (!r.ok) toast.error(r.error);
          });
        },
      },
    });
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
          >
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {!isOriginal ? (
            <DropdownMenuItem onSelect={() => setOpen("rename")}>
              <PencilLine aria-hidden />
              Rename
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => setOpen("usedIn")}>
            <NotebookPen aria-hidden />
            Edit “used in”
          </DropdownMenuItem>
          {compareOptions.length > 1 ? (
            <DropdownMenuItem onSelect={() => setOpen("compare")}>
              <GitCompare aria-hidden />
              {isOriginal ? "Compare…" : "Compare with Original"}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => setOpen("duplicate")}>
            <Copy aria-hidden />
            Duplicate as new template
          </DropdownMenuItem>
          {!isOriginal ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => void trash()}>
                <Trash2 aria-hidden />
                Move to trash
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {open === "rename" ? (
        <TextFieldDialog
          open
          onOpenChange={close}
          title="Rename variation"
          label="Name"
          initialValue={name}
          maxLength={120}
          submitLabel="Rename"
          pendingLabel="Renaming…"
          onSubmit={async (value) => {
            const r = await renameVariationAction(id, value);
            return r.ok ? null : r.error;
          }}
        />
      ) : null}

      {open === "usedIn" ? (
        <TextFieldDialog
          open
          onOpenChange={close}
          title={`Where is “${name}” used?`}
          description="A site, client or page, so you can find it later."
          label="Used in"
          optional
          initialValue={variation.usedIn ?? ""}
          placeholder="e.g. robo-agency.com"
          maxLength={2000}
          submitLabel="Save"
          pendingLabel="Saving…"
          onSubmit={async (value) => {
            const r = await setVariationUsedInAction(id, value);
            return r.ok ? null : r.error;
          }}
        />
      ) : null}

      {open === "duplicate" ? (
        <TextFieldDialog
          open
          onOpenChange={close}
          title="Duplicate as new template"
          description={`A new template whose Original is the code of “${name}”, with the same tags and notes. This template stays as it is.`}
          label="Template name"
          initialValue={duplicateName(templateName, name, isOriginal)}
          maxLength={120}
          submitLabel="Duplicate"
          pendingLabel="Duplicating…"
          onSubmit={async (value) => {
            const r = await duplicateAsTemplateAction(id, value);
            if (!r.ok) return r.error;
            if (r.type === "custom") {
              // Fills the new template's image in the background (never overwrites one).
              void requestScreenshot({ templateId: r.id, replace: false }).then((s) => {
                if (s.ok) router.refresh();
              });
            }
            toast.success("Template created");
            router.push(`/templates/${r.id}`);
            return null;
          }}
        />
      ) : null}

      {open === "compare" ? (
        <CompareDialog
          open
          onOpenChange={close}
          type={type}
          options={compareOptions}
          initialLeft={isOriginal ? id : (originalId ?? id)}
          initialRight={isOriginal ? (compareOptions.find((o) => o.id !== id)?.id ?? id) : id}
        />
      ) : null}
    </>
  );
}
