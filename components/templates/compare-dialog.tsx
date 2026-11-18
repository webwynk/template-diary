"use client";

import { AlertCircle, ArrowRight } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useId, useRef, useState } from "react";

import { getVariationContentAction } from "@/actions/templates";
import { EditorSkeleton } from "@/components/templates/editor-skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TemplateKind } from "@/lib/engine/types";
import { useMediaQuery } from "@/lib/hooks/use-media-query";

const MonacoDiff = dynamic(() => import("@/components/templates/monaco-diff"), {
  ssr: false,
  loading: () => <EditorSkeleton />,
});

/** The editor's unsaved code, offered as a side next to the saved variations. */
export const CURRENT_ID = "current";

export interface CompareOption {
  id: string;
  name: string;
}

type Loaded =
  { status: "loading" } | { status: "ready"; text: string } | { status: "error"; error: string };

/**
 * Compare any two variations (DEVELOPMENT.md Phase 7) in a read-only Monaco diff.
 * Contents are fetched when picked and cached while the dialog is open (parents remount it per
 * opening with a `key`, so an error is retried next time).
 */
export function CompareDialog({
  open,
  onOpenChange,
  type,
  options,
  initialLeft,
  initialRight,
  current,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: TemplateKind;
  options: CompareOption[];
  initialLeft: string;
  initialRight: string;
  /** The editor's current code; adds a "Current (unsaved)" choice. */
  current?: string;
}) {
  const ids = { left: useId(), right: useId() };
  const [left, setLeft] = useState(initialLeft);
  const [right, setRight] = useState(initialRight);
  const [contents, setContents] = useState<Record<string, Loaded>>({});
  const wide = useMediaQuery("(min-width: 768px)");

  // A missing entry reads as "loading"; the ref makes sure each id is requested once.
  const requested = useRef(new Set<string>());
  useEffect(() => {
    if (!open) return;
    for (const id of [left, right]) {
      if (id === CURRENT_ID || requested.current.has(id)) continue;
      requested.current.add(id);
      getVariationContentAction(id)
        .then((r): Loaded =>
          r.ok ? { status: "ready", text: r.content } : { status: "error", error: r.error },
        )
        .catch((): Loaded => ({
          status: "error",
          error: "Couldn't load this variation. Try again.",
        }))
        .then((loaded) => setContents((c) => ({ ...c, [id]: loaded })));
    }
  }, [open, left, right]);

  function textOf(id: string): Loaded {
    if (id === CURRENT_ID) return { status: "ready", text: current ?? "" };
    return contents[id] ?? { status: "loading" };
  }

  const choices: CompareOption[] = [
    ...(current !== undefined ? [{ id: CURRENT_ID, name: "Current (unsaved)" }] : []),
    ...options,
  ];
  const a = textOf(left);
  const b = textOf(right);
  const error = a.status === "error" ? a.error : b.status === "error" ? b.error : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(860px,92dvh)] w-[calc(100vw-1rem)] max-w-[1200px] flex-col gap-4 p-4 sm:max-w-[1200px] sm:p-6">
        <DialogHeader>
          <DialogTitle>Compare</DialogTitle>
          <DialogDescription>
            Removed lines are red on the left, added lines green on the right. Unchanged parts are
            folded.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-end gap-2 sm:gap-3">
          <Side id={ids.left} label="From" value={left} onChange={setLeft} choices={choices} />
          <ArrowRight className="mb-2.5 hidden size-4 text-muted-foreground sm:block" aria-hidden />
          <Side id={ids.right} label="To" value={right} onChange={setRight} choices={choices} />
        </div>
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border">
          {error ? (
            <p role="alert" className="flex items-start gap-1.5 p-4 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {error}
            </p>
          ) : a.status === "ready" && b.status === "ready" && wide !== null ? (
            <MonacoDiff
              original={a.text}
              modified={b.text}
              language={type === "custom" ? "html" : "json"}
              sideBySide={wide}
              ariaLabel="Code differences"
            />
          ) : (
            <EditorSkeleton />
          )}
        </div>
        {left === right ? (
          <p className="text-[13px] text-muted-foreground">
            Both sides are the same. Pick another one.
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Side({
  id,
  label,
  value,
  onChange,
  choices,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (id: string) => void;
  choices: CompareOption[];
}) {
  return (
    <div className="grid min-w-0 flex-1 gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-2.5 text-base shadow-xs outline-none hover:border-border-strong focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/20 md:text-sm"
      >
        {choices.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
