// Palette presets (DEVELOPMENT.md Phase 8): shared types and pure helpers.
import type { Json } from "@/types/database";

export const MAX_PRESET_COLORS = 32;

export interface PresetColor {
  /** Lowercase #rrggbb or #rrggbbaa (the database checks this). */
  hex: string;
  label: string | null;
}

export interface Preset {
  id: string;
  name: string;
  colors: PresetColor[];
  useCount: number;
  updatedAt: string;
}

/** Reads the stored colors defensively (the database already guarantees the shape). */
export function parsePresetColors(colors: Json): PresetColor[] {
  if (!Array.isArray(colors)) return [];
  const out: PresetColor[] = [];
  for (const c of colors) {
    if (typeof c !== "object" || c === null || Array.isArray(c) || typeof c.hex !== "string")
      continue;
    out.push({ hex: c.hex, label: typeof c.label === "string" && c.label ? c.label : null });
  }
  return out;
}

/**
 * Auto-suggest for "Apply preset" (DESIGN.md §7.5): the most used detected color gets the first
 * preset color, the second the second, and so on. Extra detected colors are kept (null).
 */
export function suggestMapping(
  detected: string[],
  preset: PresetColor[],
): Record<string, string | null> {
  return Object.fromEntries(detected.map((rgb, i) => [rgb, preset[i]?.hex ?? null]));
}

/**
 * The colors in the editor right now (after pending swaps), most used first, each once.
 * `targets` maps a detected color to what it is being changed to.
 */
export function currentColors(
  detected: string[],
  targets: Record<string, string | undefined>,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const rgb of detected) {
    const hex = (targets[rgb] ?? rgb).toLowerCase();
    if (seen.has(hex)) continue;
    seen.add(hex);
    out.push(hex);
    if (out.length === MAX_PRESET_COLORS) break;
  }
  return out;
}
