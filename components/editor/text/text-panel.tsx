"use client";

import { AlertTriangle, ChevronDown, Type } from "lucide-react";
import { useEffect, useState } from "react";

import {
  IconPicker,
  type IconChoice,
  useFontAwesomeCss,
} from "@/components/editor/text/icon-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import type { EditorAction, EditorState, TextEntry } from "@/lib/editor/session";
import { EngineError, type TemplateKind, type TextField, type TextModel } from "@/lib/engine";
import { elementorFontIcon } from "@/lib/engine/text/elementor";
import { cn } from "@/lib/utils";
import { textEditError } from "@/lib/validation/swaps";

/**
 * Text tab (DEVELOPMENT.md §7 "Text tab"): the template's text, links and icons as a form,
 * grouped the way the section is built. Edits go into the editor session like palette changes.
 */
export function TextPanel({
  type,
  model,
  text,
  dispatch,
  focus,
}: {
  type: TemplateKind;
  model: TextModel;
  text: EditorState["text"];
  dispatch: (action: EditorAction) => void;
  /** Click to edit (T4): open this field's group and focus it; `n` repeats the same key. */
  focus?: { key: string; n: number } | null;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const hasFontIcons = model.groups.some((g) => g.fields.some((f) => f.iconKind === "font"));
  useFontAwesomeCss(hasFontIcons);

  // A new click-to-edit request opens the field's group while rendering, so the field is on
  // screen when the effect below focuses it.
  const [handledFocus, setHandledFocus] = useState(focus);
  if (focus !== handledFocus) {
    setHandledFocus(focus);
    const group = focus && model.groups.find((g) => g.fields.some((f) => f.key === focus.key));
    if (group && collapsed.has(group.key)) {
      const next = new Set(collapsed);
      next.delete(group.key);
      setCollapsed(next);
    }
  }
  useEffect(() => {
    if (!focus) return;
    const el = document.getElementById(fieldId(focus.key));
    el?.scrollIntoView?.({ block: "center" });
    el?.focus({ preventScroll: true });
  }, [focus]);

  if (model.groups.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <Warnings warnings={model.warnings} />
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <Type className="size-5 text-muted-foreground" aria-hidden />
          <p className="text-[13px] text-muted-foreground">No text found in this template.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Warnings warnings={model.warnings} />
      <div className="min-h-0 flex-1 overflow-auto">
        {model.groups.map((group) => {
          const open = !collapsed.has(group.key);
          const headingId = `text-group-${group.key}`;
          return (
            <section key={group.key} aria-labelledby={headingId} className="border-b border-border">
              <h3 id={headingId} className="m-0">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() =>
                    setCollapsed((prev) => {
                      const next = new Set(prev);
                      if (open) next.add(group.key);
                      else next.delete(group.key);
                      return next;
                    })
                  }
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-semibold hover:bg-surface"
                >
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform",
                      !open && "-rotate-90",
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate">{group.label}</span>
                  <span className="text-xs font-normal text-muted-foreground tabular-nums">
                    {group.fields.length}
                  </span>
                </button>
              </h3>
              {open ? (
                <div className="space-y-3 px-3 pt-1 pb-4">
                  {group.fields.map((f) =>
                    f.type === "icon" ? (
                      <IconField
                        key={f.key}
                        type={type}
                        field={f}
                        entry={text[f.key]}
                        dispatch={dispatch}
                      />
                    ) : (
                      <ValueField key={f.key} field={f} entry={text[f.key]} dispatch={dispatch} />
                    ),
                  )}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Warnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="flex shrink-0 items-start gap-1.5 border-b border-border bg-warning-soft px-3 py-2 text-[12px] text-warning">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <div>
        {warnings.map((w) => (
          <p key={w}>{w}</p>
        ))}
      </div>
    </div>
  );
}

function fieldId(key: string) {
  return `text-field-${key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

/** Text, HTML and link fields. Invalid input stays in the box with an error and isn't applied. */
function ValueField({
  field,
  entry,
  dispatch,
}: {
  field: TextField;
  entry: TextEntry | undefined;
  dispatch: (action: EditorAction) => void;
}) {
  // Only set while the typed value is invalid; otherwise the box shows the session's value.
  const [draft, setDraft] = useState<{ value: string; error: string } | null>(null);
  const value = draft?.value ?? entry?.to ?? field.value;
  const id = fieldId(field.key);
  const isLink = field.type === "link";

  const change = (next: string) => {
    const to = isLink ? next.trim() : next;
    const error = textEditError({
      kind: isLink ? "link" : "text",
      key: field.key,
      from: field.value,
      to,
    });
    if (error) {
      setDraft({ value: next, error });
      return;
    }
    setDraft(null);
    if (to === field.value) dispatch({ type: "resetText", key: field.key });
    else dispatch({ type: "setText", key: field.key, entry: { to } });
  };

  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
      >
        {field.label}
        {field.type === "html" ? (
          <span className="rounded bg-surface-2 px-1 py-px font-mono text-[10px] text-muted-foreground">
            HTML
          </span>
        ) : null}
      </label>
      {isLink ? (
        <Input
          id={id}
          value={value}
          onChange={(e) => change(e.target.value)}
          placeholder="https://… or /page or #section"
          inputMode="url"
          aria-invalid={draft ? true : undefined}
          aria-describedby={draft ? `${id}-error` : undefined}
        />
      ) : (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => change(e.target.value)}
          rows={1}
          className={cn(
            "min-h-9 resize-none",
            field.type === "html" && "font-mono text-xs md:text-xs",
          )}
          aria-invalid={draft ? true : undefined}
          aria-describedby={draft ? `${id}-error` : undefined}
        />
      )}
      {draft ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {draft.error}
        </p>
      ) : null}
    </div>
  );
}

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Shows an icon without running anything: SVG code is drawn as an image. */
function IconPreview({ kind, value, shown }: { kind: string; value: string; shown: string }) {
  const box =
    "flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-base";
  if (kind === "font" || kind === "class") {
    return (
      <span className={box}>
        <i className={shown} aria-hidden />
      </span>
    );
  }
  if (kind === "image") {
    return (
      <span className={box}>
        {/* eslint-disable-next-line @next/next/no-img-element -- external icon link, preview only */}
        <img src={shown} alt="" className="max-h-6 max-w-6" />
      </span>
    );
  }
  if (kind === "svg") {
    return (
      <span className={box}>
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG drawn as an image, so it can't run scripts */}
        <img src={svgDataUrl(value)} alt="" className="max-h-6 max-w-6" />
      </span>
    );
  }
  return <span className={cn(box, "font-mono text-[10px]")}>{shown.slice(0, 6)}</span>;
}

function IconField({
  type,
  field,
  entry,
  dispatch,
}: {
  type: TemplateKind;
  field: TextField;
  entry: TextEntry | undefined;
  dispatch: (action: EditorAction) => void;
}) {
  const [open, setOpen] = useState(false);
  const kind = field.iconKind ?? "font";
  const current = entry
    ? {
        kind: entry.as === "ligature" ? "ligature" : (entry.as ?? "class"),
        value: entry.to,
        shown: entry.to,
      }
    : { kind, value: field.value, shown: field.iconValue ?? "" };
  const description =
    current.kind === "svg"
      ? "Inline SVG"
      : current.kind === "image"
        ? "Image"
        : current.shown || "Icon";

  const validate = (choice: IconChoice): string | null => {
    const error = textEditError({ kind: "icon", key: field.key, from: field.value, ...choice });
    if (error) return error;
    if (type === "elementor" && choice.as === "class") {
      try {
        elementorFontIcon(choice.to);
      } catch (e) {
        if (e instanceof EngineError) return e.message;
        throw e;
      }
    }
    return null;
  };

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{field.label}</p>
      <div className="flex items-center gap-2">
        <IconPreview kind={current.kind} value={current.value} shown={current.shown} />
        <span
          className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground"
          title={description}
        >
          {description}
        </span>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={fieldId(field.key)}
              type="button"
              variant="secondary"
              size="sm"
              aria-label={`Change ${field.label}`}
            >
              Change
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[320px] p-0 pt-2">
            <IconPicker
              type={type}
              kind={kind}
              current={field.iconValue ?? ""}
              validate={validate}
              onPick={(choice) => {
                dispatch({
                  type: "setText",
                  key: field.key,
                  entry: { to: choice.to, as: choice.as },
                });
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
