"use client";

import { Copy, MoreHorizontal, Palette, PencilLine, Plus, SwatchBook, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  createPresetAction,
  deletePresetAction,
  duplicatePresetAction,
  updatePresetAction,
} from "@/actions/presets";
import { EmptyState } from "@/components/common/empty-state";
import { PresetDialog } from "@/components/palettes/preset-dialog";
import { TextFieldDialog } from "@/components/templates/text-field-dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { plural } from "@/lib/format";
import type { Preset } from "@/lib/presets";

type Open = { kind: "create" } | { kind: "rename" | "edit" | "delete"; preset: Preset } | null;

/** Palettes page (DESIGN.md §7.6): preset cards with Rename, Edit colors, Duplicate, Delete. */
export function PalettesManager({ presets }: { presets: Preset[] }) {
  const [open, setOpen] = useState<Open>(null);
  const close = (next: boolean) => !next && setOpen(null);

  async function duplicate(preset: Preset) {
    const result = await duplicatePresetAction(preset.id);
    if (result.ok) toast.success(`“${preset.name}” duplicated`);
    else toast.error(result.error);
  }

  const newButton = (
    <Button type="button" onClick={() => setOpen({ kind: "create" })}>
      <Plus aria-hidden />
      New palette
    </Button>
  );

  return (
    <>
      {presets.length === 0 ? (
        <EmptyState
          icon={Palette}
          title="No palettes yet"
          description="Make one here, or use “Save as preset” in the editor to keep a template's colors."
          action={newButton}
        />
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{plural(presets.length, "palette")}</p>
            {newButton}
          </div>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {presets.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-border bg-background p-3 transition-shadow hover:shadow-sm"
              >
                <PresetStrip colors={p.colors.map((c) => c.hex)} />
                <div className="mt-3 flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-medium">{p.name}</h3>
                    <p className="text-[13px] text-muted-foreground">
                      {plural(p.colors.length, "color")} · used {plural(p.useCount, "time")}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`More actions for ${p.name}`}
                      >
                        <MoreHorizontal aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onSelect={() => setOpen({ kind: "rename", preset: p })}>
                        <PencilLine aria-hidden />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setOpen({ kind: "edit", preset: p })}>
                        <SwatchBook aria-hidden />
                        Edit colors
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => void duplicate(p)}>
                        <Copy aria-hidden />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setOpen({ kind: "delete", preset: p })}
                      >
                        <Trash2 aria-hidden />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {open?.kind === "create" ? (
        <PresetDialog
          open
          onOpenChange={close}
          title="New palette"
          submitLabel="Create palette"
          initialColors={[]}
          onSubmit={async (input) => {
            const r = await createPresetAction(input);
            if (!r.ok) return r.error;
            toast.success(`Palette “${r.preset.name}” created`);
            return null;
          }}
        />
      ) : null}

      {open?.kind === "edit" ? (
        <PresetDialog
          open
          onOpenChange={close}
          title="Edit palette"
          submitLabel="Save palette"
          initialName={open.preset.name}
          initialColors={open.preset.colors}
          onSubmit={async (input) => {
            const r = await updatePresetAction(open.preset.id, input);
            return r.ok ? null : r.error;
          }}
        />
      ) : null}

      {open?.kind === "rename" ? (
        <TextFieldDialog
          open
          onOpenChange={close}
          title="Rename palette"
          label="Name"
          initialValue={open.preset.name}
          maxLength={60}
          submitLabel="Rename"
          pendingLabel="Renaming…"
          onSubmit={async (name) => {
            const r = await updatePresetAction(open.preset.id, {
              name,
              colors: open.preset.colors,
            });
            return r.ok ? null : r.error;
          }}
        />
      ) : null}

      <AlertDialog open={open?.kind === "delete"} onOpenChange={close}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete “{open?.kind === "delete" ? open.preset.name : ""}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The palette is removed for good. Templates and variations made with it stay as they
              are.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (open?.kind !== "delete") return;
                const { id, name } = open.preset;
                void deletePresetAction(id).then((r) => {
                  if (r.ok) toast.success(`“${name}” deleted`);
                  else toast.error(r.error);
                });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** DESIGN.md §7.6: a 40px tall rounded strip of up to 8 swatches, "+N" for the rest. */
export function PresetStrip({ colors }: { colors: string[] }) {
  const shown = colors.slice(0, 8);
  const more = colors.length - shown.length;
  return (
    <div
      className="flex h-10 overflow-hidden rounded-lg border border-border"
      role="img"
      aria-label={`Colors: ${colors.join(", ")}`}
      title={colors.join("  ")}
    >
      {shown.map((hex, i) => (
        <span
          key={`${hex}-${i}`}
          className="flex-1"
          style={{
            backgroundImage: `linear-gradient(${hex}, ${hex}), conic-gradient(#e2e8f0 25%, #fff 0 50%, #e2e8f0 0 75%, #fff 0)`,
            backgroundSize: "100% 100%, 8px 8px",
          }}
        />
      ))}
      {more > 0 ? (
        <span className="flex items-center bg-surface px-2 text-xs font-medium text-muted-foreground">
          +{more}
        </span>
      ) : null}
    </div>
  );
}
