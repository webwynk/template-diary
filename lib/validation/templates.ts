import { z } from "zod";

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

export const idSchema = z.uuid({ message: "Unknown item." });
