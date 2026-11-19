import { z } from "zod";

import { parseTarget } from "@/lib/engine/colors";
import { isValidFontName } from "@/lib/engine/fonts";
import { ICON_CLASSES_RE } from "@/lib/engine/text/icons";
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

// --- Text tab edits (DEVELOPMENT.md §7 "Text tab") ------------------------------------------

const fieldKey = z.string().min(1).max(500);
const fromValue = z.string().max(200_000);

/** Link URLs: web, mail, phone, in-page and relative links; never javascript:, data: or vbscript:. */
export const linkUrlSchema = z
  .string()
  .trim()
  .max(2000, { message: "Links can be at most 2000 characters." })
  .refine((v) => !/[\s"'<>`\\]/.test(v), {
    message: "Links can't contain spaces, quotes, angle brackets or backslashes.",
  })
  .refine(
    (v) => {
      const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(v)?.[1]?.toLowerCase();
      return scheme === undefined || ["http", "https", "mailto", "tel", "sms"].includes(scheme);
    },
    {
      message:
        "Links can start with http://, https://, mailto: or tel:, or be relative (/page, #id).",
    },
  );

const BLOCKED_HTML_RE =
  /<\s*\/?\s*(script|style|iframe|object|embed|link|meta|base|form)\b|<!--|\son[a-z]+\s*=|=\s*["']?\s*(?:javascript|vbscript|data):/i;

/** Text and inline HTML for one field. HTML may not add scripts, styles, frames or handlers. */
export const fieldTextSchema = z
  .string()
  .max(20_000, { message: "A text field can be at most 20,000 characters." })
  .refine((v) => !BLOCKED_HTML_RE.test(v), {
    message: "Text can't contain scripts, styles, frames, comments or event handlers.",
  });

/** A pasted SVG icon: one <svg> element, no scripts, handlers or external references to code. */
export const svgIconSchema = z
  .string()
  .trim()
  .max(100_000, { message: "An SVG icon can be at most 100,000 characters." })
  .refine(
    (v) => /^<svg[\s>][\s\S]*<\/svg>$/i.test(v) && (v.match(/<svg[\s>]/gi) ?? []).length >= 1,
    {
      message: "Paste a single <svg>…</svg> element.",
    },
  )
  .refine((v) => !/<\s*(script|foreignObject|iframe|style)\b|\son[a-z]+\s*=|javascript:/i.test(v), {
    message: "SVG icons can't contain scripts, styles or event handlers.",
  });

const iconSchema = z
  .object({
    kind: z.literal("icon"),
    key: fieldKey,
    from: fromValue,
    as: z.enum(["class", "svg", "image", "ligature"]),
    to: z.string(),
  })
  .superRefine((s, ctx) => {
    const check = (schema: z.ZodType, value: string) => {
      const r = schema.safeParse(value);
      if (!r.success)
        ctx.addIssue({
          code: "custom",
          message: r.error.issues[0]?.message ?? "Invalid icon.",
          path: ["to"],
        });
    };
    if (s.as === "class")
      check(
        z
          .string()
          .trim()
          .max(200)
          .regex(ICON_CLASSES_RE, { message: "Icon classes can use letters, numbers, - and _." }),
        s.to,
      );
    else if (s.as === "svg") check(svgIconSchema, s.to);
    else if (s.as === "image") check(imageUrlSchema, s.to);
    else
      check(
        z
          .string()
          .trim()
          .regex(/^[a-z0-9_]{1,60}$/, { message: "Icon names use a–z, 0–9 and _." }),
        s.to,
      );
  });

export const swapSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), key: fieldKey, from: fromValue, to: fieldTextSchema }),
  z.object({ kind: z.literal("link"), key: fieldKey, from: fromValue, to: linkUrlSchema }),
  iconSchema,
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
  .max(1000)
  .superRefine((swaps, ctx) => {
    const seen = new Set<string>();
    for (const s of swaps) {
      const key =
        s.kind === "color"
          ? `color:${s.fromRgb.toLowerCase()}`
          : s.kind === "image"
            ? `image:${s.fromUrl}`
            : s.kind === "font"
              ? `font:${s.fromFamily.toLowerCase()}`
              : `${s.kind}:${s.key}`;
      if (seen.has(key)) {
        ctx.addIssue({ code: "custom", message: "The same item is swapped twice." });
        return;
      }
      seen.add(key);
    }
  });
