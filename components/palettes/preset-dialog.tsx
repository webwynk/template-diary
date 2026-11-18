"use client";

import { AlertCircle, ArrowDown, ArrowUp, GripVertical, Loader2, Plus, X } from "lucide-react";
import { useId, useRef, useState, useTransition } from "react";
import { HexAlphaColorPicker } from "react-colorful";

import { Swatch } from "@/components/editor/palette/color-rows";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { normalizeHex } from "@/lib/editor/session";
import { MAX_PRESET_COLORS, type PresetColor } from "@/lib/presets";
import { presetInputSchema, type PresetInput } from "@/lib/validation/presets";

interface Row {
  key: number;
  /** What the user typed; validated on save. */
  hex: string;
  label: string;
}

/**
 * Create / edit a palette (DESIGN.md §7.6): name and a list of colors with optional labels that
 * can be added, removed and reordered (drag, or the arrow buttons from the keyboard).
 * `onSubmit` returns an error to show, or null when done. Remount it per opening with a `key`.
 */
export function PresetDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  initialName = "",
  initialColors,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  submitLabel: string;
  initialName?: string;
  initialColors: PresetColor[];
  onSubmit: (input: PresetInput) => Promise<string | null>;
}) {
  const ids = { name: useId(), colors: useId() };
  const [name, setName] = useState(initialName);
  const [rows, setRows] = useState<Row[]>(() =>
    (initialColors.length > 0 ? initialColors : [{ hex: "#4f46e5", label: null }]).map((c, i) => ({
      key: i,
      hex: c.hex,
      label: c.label ?? "",
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dragFrom = useRef<number | null>(null);

  const update = (key: number, patch: Partial<Row>) => {
    setError(null);
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= rows.length || from === to) return;
    setRows((rs) => {
      const next = [...rs];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item!);
      return next;
    });
  };

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = presetInputSchema.safeParse({
      name,
      colors: rows.map((r) => ({ hex: r.hex, label: r.label })),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the palette and try again.");
      return;
    }
    startTransition(async () => {
      try {
        const message = await onSubmit(parsed.data);
        if (message) setError(message);
        else onOpenChange(false);
      } catch {
        setError("Couldn't save. Check your connection and try again.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="flex max-h-[92dvh] flex-col sm:max-w-[520px]">
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {description ?? "Name it and pick its colors. Labels like “Primary” are optional."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={ids.name}>Name</Label>
            <Input
              id={ids.name}
              value={name}
              maxLength={60}
              autoFocus
              placeholder="e.g. Robo agency"
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
            />
          </div>
          <fieldset className="flex min-h-0 flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">
              Colors{" "}
              <span className="font-normal text-muted-foreground">
                ({rows.length}/{MAX_PRESET_COLORS})
              </span>
            </legend>
            <ol className="-mx-1 min-h-0 space-y-1.5 overflow-y-auto px-1 py-0.5" id={ids.colors}>
              {rows.map((row, index) => (
                <li
                  key={row.key}
                  className="flex flex-wrap items-center gap-1.5"
                  onDragOver={(e) => {
                    if (dragFrom.current === null) return;
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragFrom.current !== null) move(dragFrom.current, index);
                    dragFrom.current = null;
                  }}
                >
                  <span
                    draggable
                    onDragStart={(e) => {
                      dragFrom.current = index;
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => (dragFrom.current = null)}
                    className="hidden cursor-grab text-muted-foreground sm:block"
                    title="Drag to reorder"
                    aria-hidden
                  >
                    <GripVertical className="size-4" />
                  </span>
                  <ColorField
                    hex={row.hex}
                    onChange={(hex) => update(row.key, { hex })}
                    position={index + 1}
                  />
                  <Input
                    value={row.label}
                    maxLength={40}
                    placeholder="Label (optional)"
                    aria-label={`Label for color ${index + 1}`}
                    onChange={(e) => update(row.key, { label: e.target.value })}
                    className="h-8 min-w-[7rem] flex-1"
                  />
                  <div className="ml-auto flex items-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Move color ${index + 1} up`}
                      disabled={index === 0}
                      onClick={() => move(index, index - 1)}
                    >
                      <ArrowUp aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Move color ${index + 1} down`}
                      disabled={index === rows.length - 1}
                      onClick={() => move(index, index + 1)}
                    >
                      <ArrowDown aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove color ${index + 1}`}
                      disabled={rows.length === 1}
                      onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
                    >
                      <X aria-hidden />
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
            <div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={rows.length >= MAX_PRESET_COLORS}
                onClick={() =>
                  setRows((rs) => [
                    ...rs,
                    {
                      key: Math.max(-1, ...rs.map((r) => r.key)) + 1,
                      hex: normalizeHex(rs.at(-1)?.hex ?? "") ?? "#ffffff",
                      label: "",
                    },
                  ])
                }
              >
                <Plus aria-hidden />
                Add color
              </Button>
            </div>
          </fieldset>
          {error ? (
            <p role="alert" className="flex items-start gap-1.5 text-[13px] text-destructive">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {pending ? "Saving…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Swatch with a picker popover plus a hex text field (both edit the same value). */
function ColorField({
  hex,
  onChange,
  position,
}: {
  hex: string;
  onChange: (hex: string) => void;
  position: number;
}) {
  const valid = normalizeHex(hex);
  return (
    <div className="flex items-center gap-1.5">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Pick color ${position}${valid ? `, now ${valid}` : ""}`}
            className="rounded-md outline-offset-2"
          >
            <Swatch color={valid ?? "transparent"} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[232px] p-3">
          <HexAlphaColorPicker
            color={valid ?? "#ffffff"}
            onChange={(v) => onChange(normalizeHex(v) ?? v)}
            style={{ width: "100%", height: 160 }}
          />
        </PopoverContent>
      </Popover>
      <Input
        value={hex}
        maxLength={9}
        spellCheck={false}
        aria-label={`Hex for color ${position}`}
        aria-invalid={valid ? undefined : true}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => valid && valid !== hex && onChange(valid)}
        className="h-8 w-[92px] font-mono text-xs md:text-xs"
      />
    </div>
  );
}
