// Parse any CSS color and write a new color back in the same format as the original.
import { colorsNamed, converter, parse } from "culori";

import type { ColorFormat } from "@/lib/engine/types";

const toRgb = converter("rgb");
const toHsl = converter("hsl");

export interface ParsedColor {
  rgb: string; // "#rrggbb"
  alpha: number; // 0..1
  format: ColorFormat;
}

/** Keywords that look like colors but aren't swappable. */
const IGNORED_KEYWORDS = new Set([
  "transparent",
  "currentcolor",
  "inherit",
  "initial",
  "unset",
  "revert",
  "none",
]);

const NAMED = new Set(Object.keys(colorsNamed));

export function isNamedColor(word: string): boolean {
  const w = word.toLowerCase();
  return NAMED.has(w) && !IGNORED_KEYWORDS.has(w);
}

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FN_RE = /^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function channel(n: number | undefined): number {
  return Math.round(clamp01(n ?? 0) * 255);
}

function hex2(n: number): string {
  return n.toString(16).padStart(2, "0");
}

function rgbHex(r: number, g: number, b: number): string {
  return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
}

function detectFormat(raw: string): ColorFormat | null {
  const hex = HEX_RE.exec(raw);
  if (hex) {
    const len = hex[1]!.length;
    return len === 3 ? "hex3" : len === 4 ? "hex4" : len === 6 ? "hex6" : "hex8";
  }
  const fn = FN_RE.exec(raw);
  if (fn) {
    const name = fn[1]!.toLowerCase();
    const modern = !raw.includes(",");
    if (name === "rgb" || name === "rgba") return modern ? "rgb-modern" : "rgb";
    if (name === "hsl" || name === "hsla") return modern ? "hsl-modern" : "hsl";
    return "other";
  }
  if (isNamedColor(raw)) return "named";
  return null;
}

/** Parse a single color token. Returns null for anything that isn't a swappable color. */
export function parseColor(raw: string): ParsedColor | null {
  const text = raw.trim();
  const format = detectFormat(text);
  if (!format) return null;
  // Colors with var()/calc() inside can't be resolved statically.
  if (/var\(|calc\(|env\(/i.test(text)) return null;
  const parsed = parse(text);
  if (!parsed) return null;
  const rgb = toRgb(parsed);
  if (!rgb) return null;
  return {
    rgb: rgbHex(channel(rgb.r), channel(rgb.g), channel(rgb.b)),
    alpha: rgb.alpha === undefined ? 1 : Math.round(clamp01(rgb.alpha) * 1000) / 1000,
    format,
  };
}

/** Parse a target color given by the UI ("#rrggbb" or "#rrggbbaa"). */
export function parseTarget(hex: string): { rgb: string; alpha: number | null } | null {
  const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex.trim());
  if (!m) return null;
  return {
    rgb: `#${m[1]!.toLowerCase()}`,
    alpha: m[2] ? Math.round((parseInt(m[2], 16) / 255) * 1000) / 1000 : null,
  };
}

function formatAlpha(a: number): string {
  // 0.5 → "0.5", 1 → "1", keep at most 3 decimals.
  return String(Math.round(a * 1000) / 1000);
}

function isUpper(raw: string): boolean {
  return /[A-F]/.test(raw) && !/[a-f]/.test(raw);
}

/**
 * Write `rgb` (+ `alpha`) in the same style as `original`.
 * Hex keeps its case and short form when possible; rgb/hsl keep legacy vs modern syntax and
 * comma spacing; named colors and exotic formats are written as hex.
 */
export function formatLike(
  original: string,
  format: ColorFormat,
  rgb: string,
  alpha: number,
): string {
  const r = parseInt(rgb.slice(1, 3), 16);
  const g = parseInt(rgb.slice(3, 5), 16);
  const b = parseInt(rgb.slice(5, 7), 16);
  const a = clamp01(alpha);
  const opaque = a >= 1;
  const upper = isUpper(original);
  const caseFix = (s: string) => (upper ? s.toUpperCase() : s.toLowerCase());
  const aHex = hex2(Math.round(a * 255));

  switch (format) {
    case "hex3":
    case "hex4":
    case "hex6":
    case "hex8": {
      const full = opaque
        ? `${hex2(r)}${hex2(g)}${hex2(b)}`
        : `${hex2(r)}${hex2(g)}${hex2(b)}${aHex}`;
      const wantsShort = format === "hex3" || format === "hex4";
      const canShort = [...full].every((_, i, arr) => i % 2 === 1 || arr[i] === arr[i + 1]);
      const body = wantsShort && canShort ? [...full].filter((_, i) => i % 2 === 0).join("") : full;
      return `#${caseFix(body)}`;
    }
    case "rgb": {
      const sep = /,\s/.test(original) ? ", " : ",";
      const name = original.trim().slice(0, 4).toLowerCase() === "rgba" || !opaque ? "rgba" : "rgb";
      const fn = upper ? name.toUpperCase() : name;
      return opaque && name === "rgb"
        ? `${fn}(${r}${sep}${g}${sep}${b})`
        : `${fn}(${r}${sep}${g}${sep}${b}${sep}${formatAlpha(a)})`;
    }
    case "rgb-modern": {
      const fn = original.trim().slice(0, 4).toLowerCase() === "rgba" ? "rgba" : "rgb";
      return opaque ? `${fn}(${r} ${g} ${b})` : `${fn}(${r} ${g} ${b} / ${formatAlpha(a)})`;
    }
    case "hsl":
    case "hsl-modern": {
      const hsl = toHsl({ mode: "rgb", r: r / 255, g: g / 255, b: b / 255 });
      const h = Math.round(hsl?.h ?? 0);
      const s = Math.round((hsl?.s ?? 0) * 100);
      const l = Math.round((hsl?.l ?? 0) * 100);
      if (format === "hsl-modern") {
        const fn = original.trim().slice(0, 4).toLowerCase() === "hsla" ? "hsla" : "hsl";
        return opaque ? `${fn}(${h} ${s}% ${l}%)` : `${fn}(${h} ${s}% ${l}% / ${formatAlpha(a)})`;
      }
      const sep = /,\s/.test(original) ? ", " : ",";
      const name = original.trim().slice(0, 4).toLowerCase() === "hsla" || !opaque ? "hsla" : "hsl";
      return opaque && name === "hsl"
        ? `${name}(${h}${sep}${s}%${sep}${l}%)`
        : `${name}(${h}${sep}${s}%${sep}${l}%${sep}${formatAlpha(a)})`;
    }
    case "named":
    case "other":
      return opaque ? rgb : `rgba(${r}, ${g}, ${b}, ${formatAlpha(a)})`;
  }
}

/**
 * The text that replaces an occurrence when its group is swapped to `targetHex`.
 * An occurrence keeps its own transparency (so tints of a brand color follow it), unless it was
 * opaque and the target itself carries an alpha.
 */
export function replacementFor(
  occ: { raw: string; format: ColorFormat; alpha: number },
  targetHex: string,
): string {
  const target = parseTarget(targetHex);
  if (!target) throw new Error(`Invalid target color: ${targetHex}`);
  const alpha = occ.alpha < 1 || target.alpha === null ? occ.alpha : target.alpha;
  return formatLike(occ.raw, occ.format, target.rgb, alpha);
}
