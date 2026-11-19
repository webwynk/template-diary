"use server";

import { getCurrentUser } from "@/lib/auth";
import * as textLabelsDb from "@/lib/db/text-labels";
import { idSchema } from "@/lib/validation/templates";
import { textLabelInputSchema } from "@/lib/validation/text-labels";

export type TextLabelActionResult = { ok: true; label: string } | { ok: false; error: string };

/**
 * Rename a Text tab group or field of a template (T5). An empty name restores the guessed one.
 * Returns the saved (trimmed) name. The editor keeps its own copy, so nothing is refreshed.
 */
export async function setTextLabelAction(
  templateId: unknown,
  input: unknown,
): Promise<TextLabelActionResult> {
  await getCurrentUser();
  const id = idSchema.safeParse(templateId);
  if (!id.success) return { ok: false, error: "This template no longer exists." };
  const parsed = textLabelInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please try again." };
  }
  const result = await textLabelsDb.setTextLabel(id.data, parsed.data);
  if (!result.ok) return result;
  return { ok: true, label: parsed.data.label };
}
