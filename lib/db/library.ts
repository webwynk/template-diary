import "server-only";

import { featureImageUrls } from "@/lib/db/feature-images";
import { toUserError, type DbResult } from "@/lib/db/result";
import type { TemplateKind } from "@/lib/engine/types";
import { createClient } from "@/lib/supabase/server";
import { findTrash, purge, type PurgeResult } from "@/lib/trash/purge";
import type { TemplateDetails } from "@/lib/validation/templates";

// Library and trash (DEVELOPMENT.md Phase 9): favorites, edit details, duplicate,
// trash / restore / delete permanently for templates, and the Trash page.

const NOT_FOUND = "This template no longer exists.";

async function updateLive(
  id: string,
  patch: { is_favorite?: boolean; deleted_at?: string | null },
  context: string,
  live: boolean,
): Promise<DbResult<null>> {
  const supabase = await createClient();
  const query = supabase.from("templates").update(patch).eq("id", id);
  const { data, error } = await (
    live ? query.is("deleted_at", null) : query.not("deleted_at", "is", null)
  ).select("id");
  if (error) return { ok: false, error: toUserError(error, context) };
  if (data.length === 0) return { ok: false, error: NOT_FOUND };
  return { ok: true, data: null };
}

export function setFavorite(id: string, isFavorite: boolean) {
  return updateLive(id, { is_favorite: isFavorite }, "setFavorite", true);
}

export function trashTemplate(id: string) {
  return updateLive(id, { deleted_at: new Date().toISOString() }, "trashTemplate", true);
}

export function restoreTemplate(id: string) {
  return updateLive(id, { deleted_at: null }, "restoreTemplate", false);
}

/** Name, tags, notes and "used in" (the type never changes). Tags are replaced as a set. */
export async function updateTemplateDetails(
  id: string,
  details: Omit<TemplateDetails, "type">,
): Promise<DbResult<null>> {
  const supabase = await createClient();
  const updated = await supabase
    .from("templates")
    .update({ name: details.name, notes: details.notes, used_in: details.usedIn })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  if (updated.error) return { ok: false, error: toUserError(updated.error, "updateTemplate") };
  if (updated.data.length === 0) return { ok: false, error: NOT_FOUND };

  if (details.tagIds.length > 0) {
    const added = await supabase.from("template_tags").upsert(
      details.tagIds.map((tagId) => ({ template_id: id, tag_id: tagId })),
      { onConflict: "template_id,tag_id", ignoreDuplicates: true },
    );
    if (added.error) {
      return {
        ok: false,
        error: toUserError(added.error, "updateTemplate.tags", {
          "23503": "One of the selected tags no longer exists. Refresh and try again.",
        }),
      };
    }
  }
  let removed = supabase.from("template_tags").delete().eq("template_id", id);
  if (details.tagIds.length > 0)
    removed = removed.not("tag_id", "in", `(${details.tagIds.join(",")})`);
  const { error } = await removed;
  if (error) return { ok: false, error: toUserError(error, "updateTemplate.untag") };
  return { ok: true, data: null };
}

/** Copies a live template, its tags and live variations (feature images are not copied). */
export async function duplicateTemplate(
  id: string,
  name: string,
): Promise<DbResult<{ id: string; type: TemplateKind }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("duplicate_template", { p_id: id, p_name: name });
  if (error)
    return { ok: false, error: toUserError(error, "duplicate_template", { P0002: NOT_FOUND }) };
  const t = await supabase.from("templates").select("type").eq("id", data).single();
  if (t.error) return { ok: false, error: toUserError(t.error, "duplicate_template.type") };
  return { ok: true, data: { id: data, type: t.data.type } };
}

// --- Trash -------------------------------------------------------------------------------------

export interface TrashEntry {
  kind: "template" | "variation";
  id: string;
  name: string;
  type: TemplateKind;
  /** For a variation: the template it belongs to. */
  template: { id: string; name: string } | null;
  imageUrl: string | null;
  deletedAt: string;
}

/** The user's trash, newest first. Items stay until deleted by hand. */
export async function listTrash(): Promise<DbResult<TrashEntry[]>> {
  const supabase = await createClient();
  const [templates, variations] = await Promise.all([
    supabase
      .from("templates")
      .select("id, name, type, feature_image_path, deleted_at")
      .not("deleted_at", "is", null),
    supabase
      .from("variations")
      .select(
        "id, name, feature_image_path, deleted_at, templates!variations_template_id_owner_id_fkey!inner(id, name, type, deleted_at)",
      )
      .not("deleted_at", "is", null)
      .is("templates.deleted_at", null),
  ]);
  if (templates.error) return { ok: false, error: toUserError(templates.error, "listTrash") };
  if (variations.error) return { ok: false, error: toUserError(variations.error, "listTrash.v") };

  const urls = featureImageUrls([
    ...templates.data.map((t) => t.feature_image_path),
    ...variations.data.map((v) => v.feature_image_path),
  ]);
  const url = (p: string | null) => (p && urls.get(p)) || null;
  const entries: TrashEntry[] = [
    ...templates.data.map((t) => ({
      kind: "template" as const,
      id: t.id,
      name: t.name,
      type: t.type,
      template: null,
      imageUrl: url(t.feature_image_path),
      deletedAt: t.deleted_at!,
    })),
    ...variations.data.map((v) => ({
      kind: "variation" as const,
      id: v.id,
      name: v.name,
      type: v.templates.type,
      template: { id: v.templates.id, name: v.templates.name },
      imageUrl: url(v.feature_image_path),
      deletedAt: v.deleted_at!,
    })),
  ].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  return { ok: true, data: entries };
}

/** Permanently deletes one trashed item, or everything in the trash. Files first, then rows. */
export async function deleteForever(
  target: { kind: "template" | "variation"; id: string } | "all",
): Promise<DbResult<PurgeResult>> {
  const supabase = await createClient();
  const found = await findTrash(
    supabase,
    target === "all"
      ? {}
      : target.kind === "template"
        ? { templateId: target.id }
        : { variationId: target.id },
  );
  if (!found.ok) return found;
  const count = found.data.templates.length + found.data.variations.length;
  if (target !== "all" && count === 0)
    return { ok: false, error: "This item is no longer in the trash." };
  const result = await purge(supabase, found.data);
  if (result.failed > 0) {
    return { ok: false, error: "Some items couldn't be deleted. Please try again." };
  }
  return { ok: true, data: result };
}
