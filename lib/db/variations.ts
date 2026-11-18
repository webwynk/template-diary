import "server-only";

import { toUserError, type DbResult } from "@/lib/db/result";
import { VARIATION_NAME_TAKEN } from "@/lib/db/templates";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

// Variation management (DEVELOPMENT.md Phase 7): rename, "used in", trash / restore.
// The Original is refused here for nice messages, and by the protect_variation trigger anyway.

export const ORIGINAL_LOCKED = "The Original is locked. It can't be renamed or moved to the trash.";
const NOT_FOUND = "This variation no longer exists.";
const VARIATION_ERRORS = { "23505": VARIATION_NAME_TAKEN };

async function findVariation(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("variations")
    .select("id, template_id, name, is_original, deleted_at")
    .eq("id", id)
    .maybeSingle();
  return { supabase, data, error };
}

/** Rename a live, non-Original variation. Names are unique per template (case/space-insensitive). */
export async function renameVariation(id: string, name: string): Promise<DbResult<null>> {
  const { supabase, data, error } = await findVariation(id);
  if (error) return { ok: false, error: toUserError(error, "renameVariation.find") };
  if (!data || data.deleted_at !== null) return { ok: false, error: NOT_FOUND };
  if (data.is_original) return { ok: false, error: ORIGINAL_LOCKED };
  const res = await supabase
    .from("variations")
    .update({ name })
    .eq("id", id)
    .eq("is_original", false)
    .is("deleted_at", null)
    .select("id");
  if (res.error)
    return { ok: false, error: toUserError(res.error, "renameVariation", VARIATION_ERRORS) };
  if (res.data.length === 0) return { ok: false, error: NOT_FOUND };
  return { ok: true, data: null };
}

/** Set the "used in" note of any live variation (the Original's note is not locked). */
export async function setVariationUsedIn(
  id: string,
  usedIn: string | null,
): Promise<DbResult<null>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("variations")
    .update({ used_in: usedIn })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  if (error) return { ok: false, error: toUserError(error, "setVariationUsedIn") };
  if (data.length === 0) return { ok: false, error: NOT_FOUND };
  return { ok: true, data: null };
}

/** Move a non-Original variation to the trash (restorable until the trash is purged). */
export async function trashVariation(id: string): Promise<DbResult<null>> {
  const { supabase, data, error } = await findVariation(id);
  if (error) return { ok: false, error: toUserError(error, "trashVariation.find") };
  if (!data) return { ok: false, error: NOT_FOUND };
  if (data.is_original) return { ok: false, error: ORIGINAL_LOCKED };
  if (data.deleted_at !== null) return { ok: true, data: null };
  const res = await supabase
    .from("variations")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("is_original", false)
    .is("deleted_at", null)
    .select("id");
  if (res.error) return { ok: false, error: toUserError(res.error, "trashVariation") };
  return { ok: true, data: null };
}

/** Bring a trashed variation back. Fails with a clear message if its name is taken meanwhile. */
export async function restoreVariation(id: string): Promise<DbResult<null>> {
  const { supabase, data, error } = await findVariation(id);
  if (error) return { ok: false, error: toUserError(error, "restoreVariation.find") };
  if (!data) return { ok: false, error: NOT_FOUND };
  if (data.deleted_at === null) return { ok: true, data: null };
  const res = await supabase
    .from("variations")
    .update({ deleted_at: null })
    .eq("id", id)
    .select("id");
  if (res.error) {
    return {
      ok: false,
      error: toUserError(res.error, "restoreVariation", {
        "23505": `Another variation is already called “${data.name}”. Rename that one first, then restore.`,
      }),
    };
  }
  return { ok: true, data: null };
}

export interface DuplicateSource {
  name: string;
  templateName: string;
  type: "custom" | "elementor";
  content: string;
  detected: Json;
  tagIds: string[];
  notes: string | null;
}

/** What "Duplicate as new template" copies: the variation's code and the template's tags/notes. */
export async function getDuplicateSource(id: string): Promise<DbResult<DuplicateSource | null>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("variations")
    .select(
      "name, content, detected, templates!variations_template_id_owner_id_fkey(name, type, notes, deleted_at, template_tags(tag_id))",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return { ok: false, error: toUserError(error, "getDuplicateSource") };
  if (!data || !data.templates || data.templates.deleted_at !== null)
    return { ok: true, data: null };
  return {
    ok: true,
    data: {
      name: data.name,
      templateName: data.templates.name,
      type: data.templates.type,
      content: data.content,
      detected: data.detected,
      tagIds: data.templates.template_tags.map((t) => t.tag_id),
      notes: data.templates.notes,
    },
  };
}
