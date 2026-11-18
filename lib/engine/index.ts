// Public API of the detection & swap engine (DEVELOPMENT.md §6). Pure functions, no I/O.
import { applyCustom } from "@/lib/engine/custom/apply";
import { detectCustom } from "@/lib/engine/custom/detect";
import { applyElementor } from "@/lib/engine/elementor/apply";
import { detectElementor } from "@/lib/engine/elementor/detect";
import {
  type ApplyResult,
  type Detection,
  EngineError,
  type Swap,
  type TemplateKind,
} from "@/lib/engine/types";

export * from "@/lib/engine/types";

/** Same limit as the database check on variations.content (DEVELOPMENT.md §5). */
export const MAX_CONTENT_BYTES = 5 * 1024 * 1024;

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
  const result = type === "custom" ? applyCustom(content, swaps) : applyElementor(content, swaps);
  checkSize(result.content);
  return result;
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
