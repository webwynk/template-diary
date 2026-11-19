// Apply swaps to a Custom template by exact character ranges. DEVELOPMENT.md §6.2, RULES.md §6.
//
// Every edit comes from a detected occurrence, is verified against the source text before it is
// written, and edits are applied from the end of the document to the start so earlier offsets
// stay valid. Anything unexpected aborts the whole apply; we never write a partial result.
import { replacementFor } from "@/lib/engine/colors";
import { detectCustom } from "@/lib/engine/custom/detect";
import { googleFamilyParam, quoteFamily } from "@/lib/engine/fonts";
import {
  type AppliedChange,
  type ApplyResult,
  type Detection,
  EngineError,
  type Location,
  type PaletteSwap,
} from "@/lib/engine/types";
import { checkSwaps, normalizedImageUrl } from "@/lib/engine/validate";

export interface Edit {
  start: number;
  end: number;
  raw: string;
  text: string;
}

export function applyCustom(
  html: string,
  swaps: PaletteSwap[],
  detection: Detection = detectCustom(html),
): ApplyResult {
  checkSwaps(swaps);
  const edits: Edit[] = [];
  const applied: AppliedChange[] = [];

  for (const swap of swaps) {
    const excluded = new Set(swap.excludeIds ?? []);
    let count = 0;
    const push = (location: Location, raw: string, text: string) => {
      if (location.kind !== "range")
        throw new EngineError("Unexpected location in a Custom template.");
      if (text === raw) return;
      edits.push({ start: location.start, end: location.end, raw, text });
      count++;
    };

    if (swap.kind === "color") {
      const group = detection.colors.find((g) => g.rgb === swap.fromRgb.toLowerCase());
      for (const occ of group?.occurrences ?? []) {
        if (!excluded.has(occ.id)) push(occ.location, occ.raw, replacementFor(occ, swap.to));
      }
    } else if (swap.kind === "image") {
      const to = normalizedImageUrl(swap.to);
      for (const occ of detection.images) {
        if (occ.url !== swap.fromUrl || excluded.has(occ.id)) continue;
        if (occ.kind === "srcset" && to.includes(",")) {
          throw new EngineError("Image links used in srcset can't contain commas.");
        }
        push(occ.location, occ.url, to);
      }
    } else {
      const from = swap.fromFamily.trim().toLowerCase();
      const to = swap.to.trim();
      for (const occ of detection.fonts) {
        if (occ.family.toLowerCase() !== from || excluded.has(occ.id)) continue;
        const attrQuote = occ.location.kind === "range" ? occ.location.attrQuote : undefined;
        const text =
          occ.kind === "font-family" ? quoteFamily(to, occ.raw, attrQuote) : googleFamilyParam(to);
        push(occ.location, occ.raw, text);
      }
    }

    if (count > 0) {
      applied.push({ kind: swap.kind, from: swapFrom(swap), to: swap.to.trim(), count });
    }
  }

  return { content: applyEdits(html, edits), applied };
}

function swapFrom(swap: PaletteSwap): string {
  if (swap.kind === "color") return swap.fromRgb.toLowerCase();
  if (swap.kind === "image") return swap.fromUrl;
  return swap.fromFamily.trim();
}

/** Replace verified ranges from the end of the text to the start. Exported for tests. */
export function applyEdits(text: string, edits: Edit[]): string {
  const sorted = [...edits].sort((a, b) => b.start - a.start);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.end > sorted[i - 1]!.start) {
      throw new EngineError("Two changes overlap the same text. Nothing was changed.");
    }
  }
  let out = text;
  for (const edit of sorted) {
    if (out.slice(edit.start, edit.end) !== edit.raw) {
      throw new EngineError("The template changed while applying swaps. Nothing was changed.");
    }
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  }
  return out;
}
