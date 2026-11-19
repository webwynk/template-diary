"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { IconAs, IconKind, TemplateKind } from "@/lib/engine";
import { cn } from "@/lib/utils";

/** The Font Awesome version the picker list was built from (scripts/build-fa-icons.mjs). */
export const FA_CSS_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css";

type FaStyle = "s" | "r" | "b";
type FaIcon = [name: string, styles: string, terms?: string];

const STYLE_NAME: Record<FaStyle, string> = { s: "Solid", r: "Regular", b: "Brands" };
const MAX_SHOWN = 240;

/** Load Font Awesome's stylesheet once, for previews in the app (not inside templates). */
export function useFontAwesomeCss(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || document.getElementById("td-fa-css")) return;
    const link = document.createElement("link");
    link.id = "td-fa-css";
    link.rel = "stylesheet";
    link.href = FA_CSS_URL;
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  }, [enabled]);
}

/**
 * Classes for a picked icon in the template's own notation: "fa fa-star" (v4), "fas fa-star"
 * (v5, and always for Elementor) or "fa-solid fa-star" (v6).
 */
export function faClasses(
  name: string,
  style: FaStyle,
  current: string,
  type: TemplateKind,
): string {
  const tokens = current.split(/\s+/);
  const v5 = type === "elementor" || tokens.some((t) => /^fa[srlbd]$/.test(t));
  const v4 =
    !v5 && tokens.includes("fa") && !tokens.some((t) => /^fa-(solid|regular|brands)$/.test(t));
  if (v4 && style === "s") return `fa fa-${name}`;
  if (v5 || v4) return `${style === "s" ? "fas" : style === "r" ? "far" : "fab"} fa-${name}`;
  return `${style === "s" ? "fa-solid" : style === "r" ? "fa-regular" : "fa-brands"} fa-${name}`;
}

export interface IconChoice {
  as: IconAs;
  to: string;
}

/** Which ways of replacing an icon a template type allows. */
export function iconModes(type: TemplateKind, kind: IconKind): IconAs[] {
  if (type === "elementor") return ["class", "image"];
  return kind === "ligature" ? ["ligature", "class", "svg", "image"] : ["class", "svg", "image"];
}

/**
 * Change an icon (DEVELOPMENT.md §7 "Text tab"): pick from Font Awesome Free 6, type classes,
 * paste an SVG (Custom only), paste an image/SVG link, or type a Material icon name.
 */
export function IconPicker({
  type,
  kind,
  current,
  onPick,
  validate,
}: {
  type: TemplateKind;
  kind: IconKind;
  /** The icon's current classes, link or name (for notation and prefilled inputs). */
  current: string;
  onPick: (choice: IconChoice) => void;
  /** Error message for a choice, or null. */
  validate: (choice: IconChoice) => string | null;
}) {
  const modes = iconModes(type, kind);
  const [tab, setTab] = useState<"fa" | IconAs>(kind === "ligature" ? "ligature" : "fa");
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as "fa" | IconAs)} className="gap-0">
      <TabsList variant="line" aria-label="Icon source" className="px-3">
        <TabsTrigger value="fa">Font Awesome</TabsTrigger>
        {modes.includes("ligature") ? <TabsTrigger value="ligature">Name</TabsTrigger> : null}
        <TabsTrigger value="class">Class</TabsTrigger>
        {modes.includes("svg") ? <TabsTrigger value="svg">SVG</TabsTrigger> : null}
        <TabsTrigger value="image">{type === "elementor" ? "SVG link" : "Image link"}</TabsTrigger>
      </TabsList>
      <TabsContent value="fa" className="border-t border-border">
        <FontAwesomeList
          type={type}
          current={current}
          onPick={(to) => onPick({ as: "class", to })}
        />
      </TabsContent>
      {(["ligature", "class", "svg", "image"] as const)
        .filter((m) => modes.includes(m))
        .map((mode) => (
          <TabsContent key={mode} value={mode} className="border-t border-border p-3">
            <ValueForm
              mode={mode}
              type={type}
              initial={
                (mode === "class" && kind === "font") ||
                (mode === "image" && kind === "image") ||
                (mode === "ligature" && kind === "ligature")
                  ? current
                  : ""
              }
              onPick={(to) => onPick({ as: mode, to })}
              validate={(to) => validate({ as: mode, to })}
            />
          </TabsContent>
        ))}
    </Tabs>
  );
}

const MODE_TEXT: Record<IconAs, { label: string; placeholder: string; hint: string }> = {
  class: {
    label: "Icon classes",
    placeholder: "fa-solid fa-star",
    hint: "Any icon font the template loads, for example bi bi-star or ri-star-line.",
  },
  svg: {
    label: "SVG code",
    placeholder: '<svg viewBox="0 0 24 24">…</svg>',
    hint: "Replaces the icon with this SVG. Scripts and event handlers aren't allowed.",
  },
  image: {
    label: "Link",
    placeholder: "https://…/icon.svg",
    hint: "An http(s) link to an image or SVG file.",
  },
  ligature: {
    label: "Material icon name",
    placeholder: "star",
    hint: "The name from fonts.google.com/icons, for example arrow_forward.",
  },
};

function ValueForm({
  mode,
  type,
  initial,
  onPick,
  validate,
}: {
  mode: IconAs;
  type: TemplateKind;
  initial: string;
  onPick: (to: string) => void;
  validate: (to: string) => string | null;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const text = MODE_TEXT[mode];
  const id = `icon-${mode}`;
  const hint =
    mode === "image" && type === "elementor"
      ? "An http(s) link to an SVG file. Elementor downloads it when you import the template."
      : text.hint;
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const message = validate(value.trim());
    setError(message);
    if (!message) onPick(value.trim());
  };
  return (
    <form onSubmit={submit} className="space-y-2">
      <label htmlFor={id} className="text-xs font-medium">
        {text.label}
      </label>
      {mode === "svg" ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={text.placeholder}
          className="max-h-48 font-mono text-xs"
          aria-invalid={error ? true : undefined}
        />
      ) : (
        <Input
          id={id}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={text.placeholder}
          className={cn(mode !== "image" && "font-mono text-xs")}
          aria-invalid={error ? true : undefined}
        />
      )}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!value.trim()}>
          Use this icon
        </Button>
      </div>
    </form>
  );
}

function FontAwesomeList({
  type,
  current,
  onPick,
}: {
  type: TemplateKind;
  current: string;
  onPick: (classes: string) => void;
}) {
  const [icons, setIcons] = useState<FaIcon[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [style, setStyle] = useState<FaStyle>("s");
  useFontAwesomeCss(true);

  useEffect(() => {
    let alive = true;
    // ~30 KB gzipped, loaded only when the picker opens.
    import("@/lib/icons/fa-free.json").then(
      (mod) => alive && setIcons(mod.default as FaIcon[]),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, []);

  const shown = useMemo(() => {
    if (!icons) return [];
    const q = query.trim().toLowerCase();
    const matches = icons.filter(
      ([name, styles, terms]) =>
        styles.includes(style) && (!q || name.includes(q) || (terms ?? "").includes(q)),
    );
    if (!q) return matches;
    // Exact name first, then names starting with the query, then the rest (stable order).
    const rank = ([name]: FaIcon) => (name === q ? 0 : name.startsWith(q) ? 1 : 2);
    return matches
      .map((icon, i) => ({ icon, i, r: rank(icon) }))
      .sort((a, b) => a.r - b.r || a.i - b.i)
      .map((x) => x.icon);
  }, [icons, query, style]);

  return (
    <div className="space-y-2 p-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search icons"
          aria-label="Search Font Awesome icons"
          className="pl-8"
          autoFocus
        />
      </div>
      <div role="radiogroup" aria-label="Icon style" className="flex gap-1">
        {(["s", "r", "b"] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={style === s}
            onClick={() => setStyle(s)}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground",
              style === s && "bg-surface-2 text-foreground",
            )}
          >
            {STYLE_NAME[s]}
          </button>
        ))}
      </div>
      {failed ? (
        <p role="alert" className="text-xs text-destructive">
          The icon list couldn&apos;t be loaded. Use the Class tab instead.
        </p>
      ) : !icons ? (
        <p className="py-6 text-center text-xs text-muted-foreground">Loading icons…</p>
      ) : shown.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">No icons match.</p>
      ) : (
        <>
          <ul
            className="grid max-h-56 grid-cols-6 gap-1 overflow-auto"
            aria-label="Font Awesome icons"
          >
            {shown.slice(0, MAX_SHOWN).map(([name]) => {
              const classes = faClasses(name, style, current, type);
              return (
                <li key={name}>
                  <button
                    type="button"
                    title={name}
                    aria-label={`${name} (${STYLE_NAME[style]})`}
                    onClick={() => onPick(classes)}
                    className="flex aspect-square w-full items-center justify-center rounded-md text-base text-foreground hover:bg-surface-2 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                  >
                    <i className={faClasses(name, style, "", "custom")} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
          {shown.length > MAX_SHOWN ? (
            <p className="text-xs text-muted-foreground">
              Showing {MAX_SHOWN} of {shown.length}. Search to narrow it down.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
