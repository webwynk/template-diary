import { z } from "zod";

export const idSchema = z.uuid({ message: "Unknown item." });

// Mirrors the database checks on templates (DEVELOPMENT.md §5.2).
export const templateNameSchema = z
  .string()
  .trim()
  .min(1, { message: "Enter a template name." })
  .max(120, { message: "Template names can be at most 120 characters." });

export const templateTypeSchema = z.enum(["custom", "elementor"], {
  message: "Choose Custom code or Elementor.",
});

/** Empty strings become null so optional fields are stored as "not set". */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { message: `${label} can be at most ${max.toLocaleString("en-US")} characters.` })
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

export const templateDetailsSchema = z.object({
  name: templateNameSchema,
  type: templateTypeSchema,
  tagIds: z
    .array(z.uuid({ message: "Unknown tag." }))
    .max(50, { message: "A template can have at most 50 tags." })
    .transform((ids) => [...new Set(ids)]),
  notes: optionalText(5000, "Notes"),
  usedIn: optionalText(2000, "“Used in”"),
});

export type TemplateDetailsInput = z.input<typeof templateDetailsSchema>;
export type TemplateDetails = z.output<typeof templateDetailsSchema>;

export const variationNameSchema = z
  .string()
  .trim()
  .min(1, { message: "Enter a name for this variation." })
  .max(120, { message: "Variation names can be at most 120 characters." });

export const saveVariationSchema = z.object({
  templateId: idSchema,
  baseVariationId: idSchema,
  name: variationNameSchema,
  usedIn: optionalText(2000, "“Used in”"),
});

export type SaveVariationInput = z.output<typeof saveVariationSchema>;

/** Which feature image: the template's, or one variation's. */
export const featureTargetSchema = z.object({
  templateId: idSchema,
  variationId: idSchema.optional(),
});

/** Body of POST /api/screenshot. */
export const screenshotRequestSchema = featureTargetSchema.extend({
  /** false (after creating): only fill an empty image; true: replace the current one. */
  replace: z.boolean().default(true),
});

/** Fields of "Save changes" (overwrite a variation in place). */
export const updateVariationSchema = z.object({
  templateId: idSchema,
  variationId: idSchema,
  /** updated_at the editor loaded; the save is refused if the variation changed since. */
  baseUpdatedAt: z.string().min(1).max(64),
});
