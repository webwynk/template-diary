"use client";

import { AlertTriangle, ArrowRight, ImageOff, RotateCcw } from "lucide-react";
import { useId, useState } from "react";

import { EmptyTab } from "@/components/editor/palette/color-rows";
import { OccurrenceList } from "@/components/editor/palette/occurrence-list";
import type { PaletteProps } from "@/components/editor/palette/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ImageKind, ImageOccurrence } from "@/lib/engine/types";
import { imageUrlSchema } from "@/lib/validation/swaps";

const KIND_LABEL: Record<ImageKind, string> = {
  "img-src": "img",
  srcset: "srcset",
  poster: "poster",
  "css-url": "css url()",
  "link-preload": "preload",
  elementor: "Elementor",
};

interface ImageGroup {
  url: string;
  occurrences: ImageOccurrence[];
  warning?: ImageOccurrence["warning"];
}

function groupImages(images: ImageOccurrence[]): ImageGroup[] {
  const map = new Map<string, ImageGroup>();
  for (const img of images) {
    const group = map.get(img.url) ?? { url: img.url, occurrences: [], warning: img.warning };
    group.occurrences.push(img);
    map.set(img.url, group);
  }
  return [...map.values()];
}

/** Images tab (DESIGN.md §7.5): replace by pasting a link (no uploads, RULES.md). */
export function ImageGrid({ detection, pending, dispatch, onJump }: PaletteProps) {
  const groups = groupImages(detection.images);
  const [expanded, setExpanded] = useState<string | null>(null);
  if (groups.length === 0) return <EmptyTab text="No images found in this template." />;

  return (
    <ul className="grid grid-cols-2 gap-3 p-3">
      {groups.map((group) => {
        const entry = pending.image[group.url];
        const open = expanded === group.url;
        return (
          <li key={group.url} className={open ? "col-span-2" : undefined}>
            <div className="overflow-hidden rounded-lg border border-border bg-background">
              <ReplacePopover
                from={group.url}
                value={entry?.to}
                onApply={(to) =>
                  dispatch({ type: "setTarget", kind: "image", from: group.url, to })
                }
              >
                <button
                  type="button"
                  className="relative block aspect-[16/10] w-full bg-surface-2"
                  aria-label={`Replace image ${group.url}`}
                >
                  <Thumb url={entry?.to ?? group.url} />
                  {entry ? (
                    <span className="absolute top-1.5 left-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                      Replaced
                    </span>
                  ) : null}
                </button>
              </ReplacePopover>
              <div className="flex items-center gap-1 px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : group.url)}
                  aria-expanded={open}
                  className="min-w-0 flex-1 text-left text-[11px] text-muted-foreground"
                >
                  <span className="block truncate font-mono text-foreground/80" title={group.url}>
                    {group.url.startsWith("data:") ? "data: URI" : group.url}
                  </span>
                  <span className="flex items-center gap-1">
                    {group.occurrences.length}×{" "}
                    {[...new Set(group.occurrences.map((o) => KIND_LABEL[o.kind]))].join(", ")}
                    {group.warning ? (
                      <span className="inline-flex items-center gap-0.5 text-warning">
                        <AlertTriangle className="size-3" aria-hidden />
                        {group.warning === "data-uri" ? "embedded" : "relative path"}
                      </span>
                    ) : null}
                  </span>
                </button>
                {entry ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-7"
                    aria-label="Reset image"
                    title="Reset"
                    onClick={() => dispatch({ type: "resetRow", kind: "image", from: group.url })}
                  >
                    <RotateCcw aria-hidden />
                  </Button>
                ) : null}
              </div>
              {open ? (
                <OccurrenceList
                  items={group.occurrences.map((o) => ({
                    id: o.id,
                    location: o.location,
                    snippet: o.snippet,
                    highlight: o.url.slice(0, 60),
                    label: KIND_LABEL[o.kind],
                  }))}
                  excluded={entry?.excludeIds}
                  onToggle={(id) =>
                    dispatch({ type: "toggleExclude", kind: "image", from: group.url, id })
                  }
                  onJump={onJump}
                />
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Only absolute http(s) and data: links are shown; a relative path would load from this app. */
function Thumb({ url }: { url: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const showable = /^(https?:|data:image\/)/i.test(url) && failed !== url;
  if (!showable) {
    return (
      <span className="flex h-full items-center justify-center text-subtle-foreground">
        <ImageOff className="size-5" aria-hidden />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary external links, not optimizable
    <img
      src={url}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(url)}
      className="h-full w-full object-cover"
    />
  );
}

function ReplacePopover({
  from,
  value,
  onApply,
  children,
}: {
  from: string;
  value: string | undefined;
  onApply: (url: string) => void;
  children: React.ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [error, setError] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);
  const parsed = imageUrlSchema.safeParse(draft);

  function apply(event: React.FormEvent) {
    event.preventDefault();
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Paste an image link.");
      return;
    }
    onApply(parsed.data);
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setDraft(value ?? "");
          setError(null);
          setBroken(false);
        }
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-[300px] p-3">
        <form onSubmit={apply} noValidate className="space-y-2">
          <label htmlFor={id} className="text-sm font-medium">
            Replace image
          </label>
          <p className="flex items-center gap-1 truncate font-mono text-[11px] text-muted-foreground">
            <span className="truncate" title={from}>
              {from.startsWith("data:") ? "data: URI" : from}
            </span>
            <ArrowRight className="size-3 shrink-0" aria-hidden />
          </p>
          <Input
            id={id}
            value={draft}
            autoFocus
            placeholder="https://…"
            onChange={(e) => {
              setDraft(e.target.value);
              setError(null);
              setBroken(false);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
          />
          {parsed.success ? (
            <div className="aspect-[16/10] overflow-hidden rounded-md border border-border bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- live check of a pasted link */}
              <img
                key={parsed.data}
                src={parsed.data}
                alt="New image"
                referrerPolicy="no-referrer"
                onError={() => setBroken(true)}
                onLoad={() => setBroken(false)}
                className="h-full w-full object-cover"
              />
            </div>
          ) : null}
          {broken ? (
            <p className="flex items-start gap-1 text-[12px] text-warning">
              <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
              This link didn&apos;t load as an image here. You can still use it.
            </p>
          ) : null}
          {error ? (
            <p id={`${id}-error`} role="alert" className="text-[12px] text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Apply
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
