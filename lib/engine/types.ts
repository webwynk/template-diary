// Detection & swap engine types (DEVELOPMENT.md §6.1). Pure data, no I/O.

export type TemplateKind = "custom" | "elementor";

/** Same limit as the database check on variations.content (DEVELOPMENT.md §5). */
export const MAX_CONTENT_BYTES = 5 * 1024 * 1024;

export type ColorFormat =
  | "hex3"
  | "hex4"
  | "hex6"
  | "hex8"
  | "rgb" // rgb()/rgba() legacy comma syntax
  | "rgb-modern" // rgb(0 0 0 / .5)
  | "hsl" // hsl()/hsla() legacy comma syntax
  | "hsl-modern"
  | "named"
  | "other"; // hwb(), lab(), oklch(), color() … written back as hex

/** Where an occurrence lives: a character range (Custom) or a JSON path (Elementor). */
export type Location =
  | {
      kind: "range";
      start: number;
      end: number;
      line: number;
      /** Quote character of the surrounding HTML attribute, if the text sits inside one. */
      attrQuote?: '"' | "'";
    }
  | { kind: "path"; path: (string | number)[] };

export type ColorContext =
  "style-tag" | "style-attr" | "css-var-def" | "svg-attr" | "elementor-setting";

export interface ColorOccurrence {
  id: string;
  /** Exact source text, e.g. "rgba(79,70,229,.5)". */
  raw: string;
  format: ColorFormat;
  /** Normalized base color "#rrggbb" (lowercase). This is the grouping key. */
  rgb: string;
  /** 0..1 */
  alpha: number;
  location: Location;
  context: ColorContext;
  /** For css-var-def: the custom property name, e.g. "--brand". */
  varName?: string;
  snippet: string;
}

export interface ColorGroup {
  rgb: string;
  count: number;
  formats: ColorFormat[];
  occurrences: ColorOccurrence[];
}

export type ImageKind = "img-src" | "srcset" | "poster" | "css-url" | "link-preload" | "elementor";

export interface ImageOccurrence {
  id: string;
  url: string;
  kind: ImageKind;
  location: Location;
  warning?: "data-uri" | "relative";
  snippet: string;
}

export type FontKind = "font-family" | "google-fonts-link" | "css-import" | "elementor-typography";

export interface FontOccurrence {
  id: string;
  /** Family name without quotes, e.g. "Open Sans". */
  family: string;
  /** Exact source text that a swap replaces (may include quotes, or "+" for Google URLs). */
  raw: string;
  kind: FontKind;
  location: Location;
  snippet: string;
}

export interface Detection {
  colors: ColorGroup[];
  images: ImageOccurrence[];
  fonts: FontOccurrence[];
  warnings: string[];
}

/** Palette swaps: replace every occurrence of a value (minus excluded occurrences). */
export type PaletteSwap =
  | { kind: "color"; fromRgb: string; to: string; excludeIds?: string[] }
  | { kind: "image"; fromUrl: string; to: string; excludeIds?: string[] }
  | { kind: "font"; fromFamily: string; to: string; excludeIds?: string[] };

/** How an icon field is replaced: icon classes, a pasted SVG, an image link, or a ligature name. */
export type IconAs = "class" | "svg" | "image" | "ligature";

/**
 * Text tab edits (DEVELOPMENT.md §7 "Text tab"): change ONE field, found by its structural key.
 * `from` is the field's value as detected; the engine refuses the edit if it no longer matches.
 * They are applied after the palette swaps, to the palette's result.
 */
export type TextSwap =
  | { kind: "text"; key: string; from: string; to: string }
  | { kind: "link"; key: string; from: string; to: string }
  | { kind: "icon"; key: string; from: string; to: string; as: IconAs };

export type Swap = PaletteSwap | TextSwap;

export function isTextSwap(swap: Swap): swap is TextSwap {
  return swap.kind === "text" || swap.kind === "link" || swap.kind === "icon";
}

export interface AppliedChange {
  kind: Swap["kind"];
  from: string;
  to: string;
  count: number;
  /** Text tab edits: the field's structural key (from/to are shortened to 200 characters). */
  key?: string;
}

export interface ApplyResult {
  content: string;
  applied: AppliedChange[];
}

/** Thrown when content can't be processed safely. The message is safe to show to the user. */
export class EngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngineError";
  }
}
