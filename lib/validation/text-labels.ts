import { z } from "zod";

// Mirrors public.text_labels (DEVELOPMENT.md §5.2, Text tab T5): kind group|field, key 1–1000
// characters, name 1–60 after trimming. An empty name means "use the guessed name again".
export const TEXT_LABEL_MAX = 60;

export const textLabelInputSchema = z.object({
  kind: z.enum(["group", "field"], { message: "Unknown item." }),
  key: z.string().min(1, { message: "Unknown item." }).max(1000, { message: "Unknown item." }),
  label: z
    .string()
    .trim()
    .max(TEXT_LABEL_MAX, { message: `Names can be at most ${TEXT_LABEL_MAX} characters.` }),
});

export type TextLabelInput = z.infer<typeof textLabelInputSchema>;

/** The names the user gave a template's Text tab groups and fields, by structural key. */
export interface TextLabels {
  group: Record<string, string>;
  field: Record<string, string>;
}

export const EMPTY_TEXT_LABELS: TextLabels = { group: {}, field: {} };
