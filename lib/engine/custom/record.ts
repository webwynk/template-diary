// Shared state of a Custom detection run and helpers that record occurrences. Every recorded
// occurrence is checked to equal the source text at its range.
import { parseColor } from "@/lib/engine/colors";
import { googleFontFamilies } from "@/lib/engine/fonts";
import { lineAt, snippetAt } from "@/lib/engine/text";
import type {
  ColorContext,
  ColorOccurrence,
  FontKind,
  FontOccurrence,
  ImageKind,
  ImageOccurrence,
} from "@/lib/engine/types";

export type Quote = '"' | "'";

export interface Ctx {
  html: string;
  lines: number[];
  colors: ColorOccurrence[];
  images: ImageOccurrence[];
  fonts: FontOccurrence[];
  warnings: string[];
}

function range(ctx: Ctx, s: number, len: number, attrQuote?: Quote) {
  return {
    kind: "range" as const,
    start: s,
    end: s + len,
    line: lineAt(ctx.lines, s),
    ...(attrQuote ? { attrQuote } : {}),
  };
}

export function addColor(
  ctx: Ctx,
  raw: string,
  s: number,
  context: ColorContext,
  varName?: string,
): void {
  if (ctx.html.slice(s, s + raw.length) !== raw) return; // safety: must match the source exactly
  const parsed = parseColor(raw);
  if (!parsed) return;
  ctx.colors.push({
    id: `color:${s}`,
    raw,
    format: parsed.format,
    rgb: parsed.rgb,
    alpha: parsed.alpha,
    location: range(ctx, s, raw.length),
    context,
    ...(varName ? { varName } : {}),
    snippet: snippetAt(ctx.html, s, s + raw.length),
  });
}

export function addImage(
  ctx: Ctx,
  url: string,
  s: number,
  kind: ImageKind,
  attrQuote?: Quote,
): void {
  if (!url) return;
  if (ctx.html.slice(s, s + url.length) !== url) return; // safety: must match the source exactly
  const warning = /^data:/i.test(url)
    ? ("data-uri" as const)
    : /^(https?:)?\/\//i.test(url)
      ? undefined
      : ("relative" as const);
  ctx.images.push({
    id: `image:${s}`,
    url,
    kind,
    location: range(ctx, s, url.length, attrQuote),
    ...(warning ? { warning } : {}),
    snippet: snippetAt(ctx.html, s, s + Math.min(url.length, 60)),
  });
}

export function addGoogleFonts(
  ctx: Ctx,
  url: string,
  urlStart: number,
  kind: FontKind,
  attrQuote?: Quote,
): void {
  for (const f of googleFontFamilies(url)) {
    addFont(ctx, f.family, f.raw, urlStart + f.offset, kind, attrQuote);
  }
}

export function addFont(
  ctx: Ctx,
  family: string,
  raw: string,
  s: number,
  kind: FontKind,
  attrQuote?: Quote,
): void {
  if (ctx.html.slice(s, s + raw.length) !== raw) return;
  ctx.fonts.push({
    id: `font:${s}`,
    family,
    raw,
    kind,
    location: range(ctx, s, raw.length, attrQuote),
    snippet: snippetAt(ctx.html, s, s + raw.length),
  });
}
