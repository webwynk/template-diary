import { z } from "zod";

import { TAG_COLORS } from "@/lib/tags";

const hexes = TAG_COLORS.map((c) => c.hex) as [string, ...string[]];

// Mirrors the database check: 1–40 characters after trimming (DEVELOPMENT.md §5.2).
export const tagNameSchema = z
  .string()
  .trim()
  .min(1, { message: "Enter a tag name." })
  .max(40, { message: "Tag names can be at most 40 characters." });

export const tagColorSchema = z.enum(hexes, { message: "Pick one of the tag colors." });

export const createTagSchema = z.object({
  name: tagNameSchema,
  color: tagColorSchema,
});

export const updateTagSchema = z
  .object({
    id: z.uuid(),
    name: tagNameSchema.optional(),
    color: tagColorSchema.optional(),
  })
  .refine((v) => v.name !== undefined || v.color !== undefined, {
    message: "Nothing to update.",
  });

export const deleteTagSchema = z.object({ id: z.uuid() });

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
