// Public API of the detection & swap engine (DEVELOPMENT.md §6). Pure functions, no I/O.
import { applyCustom } from "@/lib/engine/custom/apply";
import { detectCustom } from "@/lib/engine/custom/detect";
import { applyElementor } from "@/lib/engine/elementor/apply";
import { checkSwaps } from "@/lib/engine/validate";
import { detectElementor } from "@/lib/engine/elementor/detect";
import {
  annotateTextCustom,
  applyTextCustom,
  detectTextCustom,
  TEXT_KEY_ATTR,
} from "@/lib/engine/text/custom";
import { applyTextElementor, detectTextElementor } from "@/lib/engine/text/elementor";
import type { TextModel } from "@/lib/engine/text/types";
import {
  type ApplyResult,
  type Detection,
  EngineError,
  isTextSwap,
  MAX_CONTENT_BYTES,
  type PaletteSwap,
  type Swap,
  type TemplateKind,
} from "@/lib/engine/types";

export * from "@/lib/engine/types";
export type * from "@/lib/engine/text/types";

function checkSize(content: string): void {
  if (new TextEncoder().encode(content).length > MAX_CONTENT_BYTES) {
    throw new EngineError("This template is larger than 5 MB.");
  }
}

export function detect(content: string, type: TemplateKind): Detection {
  checkSize(content);
  return type === "custom" ? detectCustom(content) : detectElementor(content);
}

/**
 * Apply swaps and return the new content plus an old → new list of what changed.
 * Swaps that match nothing (or would write the same text) are left out of `applied`.
 */
export function applySwaps(content: string, type: TemplateKind, swaps: Swap[]): ApplyResult {
  checkSize(content);
  checkSwaps(swaps);
  // Palette swaps first (their excluded ids are offsets in `content`), then Text tab edits on the
  // palette's result, which is also what the Text tab shows (DEVELOPMENT.md §7 "Text tab").
  const palette = swaps.filter((s): s is PaletteSwap => !isTextSwap(s));
  const text = swaps.filter(isTextSwap);
  let result = type === "custom" ? applyCustom(content, palette) : applyElementor(content, palette);
  if (text.length > 0) {
    const edited =
      type === "custom"
        ? applyTextCustom(result.content, text)
        : applyTextElementor(result.content, text);
    result = { content: edited.content, applied: [...result.applied, ...edited.applied] };
  }
  checkSize(result.content);
  return result;
}

/** The Text tab's groups and fields for this content. */
export function detectText(content: string, type: TemplateKind): TextModel {
  checkSize(content);
  return type === "custom" ? detectTextCustom(content) : detectTextElementor(content);
}

export { TEXT_KEY_ATTR };

/**
 * Custom only: the content with each text field's element marked for click-to-edit in the
 * preview (phase T4). Returns the content unchanged if it can't be read. Never saved.
 */
export function annotateTextForPreview(content: string): string {
  try {
    checkSize(content);
    return annotateTextCustom(content);
  } catch {
    return content;
  }
}

/** Small summary cached in variations.detected for list views (swatches, counts). */
export interface DetectionSummary {
  v: 1;
  colors: { rgb: string; count: number }[];
  colorCount: number;
  imageCount: number;
  fonts: string[];
  warningCount: number;
}

export const SUMMARY_MAX_COLORS = 12;
export const SUMMARY_MAX_FONTS = 10;

export function summarize(detection: Detection): DetectionSummary {
  const fonts: string[] = [];
  for (const f of detection.fonts) {
    if (!fonts.some((x) => x.toLowerCase() === f.family.toLowerCase())) fonts.push(f.family);
  }
  return {
    v: 1,
    colors: detection.colors
      .slice(0, SUMMARY_MAX_COLORS)
      .map((g) => ({ rgb: g.rgb, count: g.count })),
    colorCount: detection.colors.length,
    imageCount: new Set(detection.images.map((i) => i.url)).size,
    fonts: fonts.slice(0, SUMMARY_MAX_FONTS),
    warningCount: detection.warnings.length,
  };
}
