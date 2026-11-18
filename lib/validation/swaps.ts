import { z } from "zod";

import { parseTarget } from "@/lib/engine/colors";
import { isValidFontName } from "@/lib/engine/fonts";
import type { Swap } from "@/lib/engine/types";

// Characters that could break out of an HTML attribute, a CSS url() or a srcset list.
const UNSAFE_URL_CHARS = /[\s"'()<>\\`]/;

/** A pasted image link: http(s) only (RULES.md §7), and safe to drop into HTML, CSS or JSON. */
export const imageUrlSchema = z
  .string()
  .trim()
  .min(1, { message: "Paste an image link." })
  .max(2000, { message: "Image links can be at most 2000 characters." })
  .refine((v) => !UNSAFE_URL_CHARS.test(v), {
    message: "Image links can't contain spaces, quotes, brackets or backslashes.",
  })
  .refine(
    (v) => {
      try {
        const url = new URL(v);
        return (url.protocol === "http:" || url.protocol === "https:") && url.hostname !== "";
      } catch {
        return false;
      }
    },
    { message: "Image links must start with http:// or https://." },
  );

export const targetColorSchema = z
  .string()
  .trim()
  .refine((v) => parseTarget(v) !== null, { message: "Pick a color like #4f46e5." });

export const fontNameSchema = z
  .string()
  .trim()
  .refine(isValidFontName, { message: "Font names can use letters, numbers, spaces and hyphens." });

const excludeIds = z.array(z.string().min(1).max(500)).max(5000).optional();

export const swapSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("color"),
    fromRgb: z.string().regex(/^#[0-9a-fA-F]{6}$/, { message: "Unknown source color." }),
    to: targetColorSchema,
    excludeIds,
  }),
  z.object({
    kind: z.literal("image"),
    fromUrl: z.string().min(1).max(100_000),
    to: imageUrlSchema,
    excludeIds,
  }),
  z.object({
    kind: z.literal("font"),
    fromFamily: z.string().trim().min(1).max(200),
    to: fontNameSchema,
    excludeIds,
  }),
]) satisfies z.ZodType<Swap>;

export const swapListSchema = z
  .array(swapSchema)
  .max(500)
  .superRefine((swaps, ctx) => {
    const seen = new Set<string>();
    for (const s of swaps) {
      const key =
        s.kind === "color"
          ? `color:${s.fromRgb.toLowerCase()}`
          : s.kind === "image"
            ? `image:${s.fromUrl}`
            : `font:${s.fromFamily.toLowerCase()}`;
      if (seen.has(key)) {
        ctx.addIssue({ code: "custom", message: "The same item is swapped twice." });
        return;
      }
      seen.add(key);
    }
  });
