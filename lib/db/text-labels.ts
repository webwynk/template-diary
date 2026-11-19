import "server-only";

import { toUserError, type DbResult } from "@/lib/db/result";
import { createClient } from "@/lib/supabase/server";
import type { TextLabelInput, TextLabels } from "@/lib/validation/text-labels";

// Text tab names (T5), table public.text_labels: one row per renamed group or field of a template.

// Postgres foreign_key_violation: the template is gone or not the user's.
const NOT_FOUND = "This template no longer exists.";
const ERRORS = { "23503": NOT_FOUND };

/** The template's names; keys the template no longer has are simply never asked for. */
export async function listTextLabels(templateId: string): Promise<DbResult<TextLabels>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("text_labels")
    .select("kind, field_key, label")
    .eq("template_id", templateId);
  if (error) return { ok: false, error: toUserError(error, "listTextLabels") };
  const labels: TextLabels = { group: {}, field: {} };
  for (const row of data) {
    if (row.kind === "group" || row.kind === "field") labels[row.kind][row.field_key] = row.label;
  }
  return { ok: true, data: labels };
}

/** Save a name, or delete it when the name is empty (the guessed name is shown again). */
export async function setTextLabel(
  templateId: string,
  input: TextLabelInput,
): Promise<DbResult<null>> {
  const supabase = await createClient();
  if (input.label === "") {
    const { error } = await supabase
      .from("text_labels")
      .delete()
      .eq("template_id", templateId)
      .eq("kind", input.kind)
      .eq("field_key", input.key);
    if (error) return { ok: false, error: toUserError(error, "setTextLabel.delete") };
    return { ok: true, data: null };
  }
  const { error } = await supabase
    .from("text_labels")
    .upsert(
      { template_id: templateId, kind: input.kind, field_key: input.key, label: input.label },
      { onConflict: "template_id,kind,field_key" },
    );
  if (error) return { ok: false, error: toUserError(error, "setTextLabel", ERRORS) };
  return { ok: true, data: null };
}
