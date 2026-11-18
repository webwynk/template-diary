import { z } from "zod";

import { normalizeHex } from "@/lib/editor/session";
import { MAX_PRESET_COLORS } from "@/lib/presets";

// Mirrors the database: name 1–60 after trimming, unique per user (case/space-insensitive);
// 1–32 colors, each lowercase #rrggbb / #rrggbbaa with an optional label of up to 40 characters.
export const presetNameSchema = z
  .string()
  .trim()
  .min(1, { message: "Enter a palette name." })
  .max(60, { message: "Palette names can be at most 60 characters." });

export const presetColorSchema = z.object({
  hex: z.string().transform((v, ctx) => {
    const hex = normalizeHex(v);
    if (!hex) {
      ctx.addIssue({ code: "custom", message: `“${v}” is not a hex color like #4f46e5.` });
      return z.NEVER;
    }
    return hex;
  }),
  label: z
    .string()
    .trim()
    .max(40, { message: "Color labels can be at most 40 characters." })
    .nullish()
    .transform((v) => (v ? v : null)),
});

export const presetColorsSchema = z
  .array(presetColorSchema)
  .min(1, { message: "Add at least one color." })
  .max(MAX_PRESET_COLORS, {
    message: `A palette can have at most ${MAX_PRESET_COLORS} colors.`,
  });

export const presetInputSchema = z.object({
  name: presetNameSchema,
  colors: presetColorsSchema,
});
export type PresetInput = z.infer<typeof presetInputSchema>;
