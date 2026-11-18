// Detection & swap engine types (DEVELOPMENT.md §6.1). Pure data, no I/O.

export type TemplateKind = "custom" | "elementor";

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

export type Swap =
  | { kind: "color"; fromRgb: string; to: string; excludeIds?: string[] }
  | { kind: "image"; fromUrl: string; to: string; excludeIds?: string[] }
  | { kind: "font"; fromFamily: string; to: string; excludeIds?: string[] };

export interface AppliedChange {
  kind: Swap["kind"];
  from: string;
  to: string;
  count: number;
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
