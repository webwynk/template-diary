import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { FEATURE_BUCKET } from "@/lib/db/feature-images";
import type { Database } from "@/types/database";

// Permanent deletion (DEVELOPMENT.md Phase 9). Used by "Delete permanently" / "Empty trash"
// as the signed-in user (RLS applies). There is no automatic purge: trash is emptied by hand.
// Storage files are deleted FIRST; a row is only deleted once its files are gone, so a
// failure leaves the item in the trash to be retried, never an orphaned file.

type Client = SupabaseClient<Database>;

export interface TrashedTemplate {
  id: string;
  ownerId: string;
  deletedAt: string;
}
export interface TrashedVariation {
  id: string;
  ownerId: string;
  templateId: string;
  featureImagePath: string | null;
  deletedAt: string;
}
export interface TrashItems {
  templates: TrashedTemplate[];
  variations: TrashedVariation[];
}
export interface PurgeResult {
  templates: number;
  variations: number;
  failed: number;
}

/**
 * Trashed templates, and trashed variations of live templates (a trashed template takes all of
 * its variations with it). With the user client this is the user's own trash.
 */
export async function findTrash(
  client: Client,
  filter: { templateId?: string; variationId?: string } = {},
): Promise<{ ok: true; data: TrashItems } | { ok: false; error: string }> {
  let templates = client
    .from("templates")
    .select("id, owner_id, deleted_at")
    .not("deleted_at", "is", null);
  let variations = client
    .from("variations")
    .select(
      "id, owner_id, template_id, feature_image_path, deleted_at, templates!variations_template_id_owner_id_fkey!inner(deleted_at)",
    )
    .not("deleted_at", "is", null)
    .is("templates.deleted_at", null);
  if (filter.templateId) templates = templates.eq("id", filter.templateId);
  if (filter.variationId) variations = variations.eq("id", filter.variationId);
  const wantTemplates = !filter.variationId;
  const wantVariations = !filter.templateId;
  const [t, v] = await Promise.all([
    wantTemplates ? templates : Promise.resolve({ data: [], error: null }),
    wantVariations ? variations : Promise.resolve({ data: [], error: null }),
  ]);
  if (t.error || v.error) {
    console.error("[trash] findTrash", t.error?.message ?? v.error?.message);
    return { ok: false, error: "Couldn't read the trash. Please try again." };
  }
  return {
    ok: true,
    data: {
      templates: (t.data ?? []).map((r) => ({
        id: r.id,
        ownerId: r.owner_id,
        deletedAt: r.deleted_at!,
      })),
      variations: (v.data ?? []).map((r) => ({
        id: r.id,
        ownerId: r.owner_id,
        templateId: r.template_id,
        featureImagePath: r.feature_image_path,
        deletedAt: r.deleted_at!,
      })),
    },
  };
}

/** All files in a template's Storage folder ({owner}/{template}/…), including old leftovers. */
async function templateFiles(client: Client, t: TrashedTemplate): Promise<string[] | null> {
  const folder = `${t.ownerId}/${t.id}`;
  const files: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.storage
      .from(FEATURE_BUCKET)
      .list(folder, { limit: 1000, offset });
    if (error) {
      console.error("[trash] list", folder, error.message);
      return null;
    }
    // Entries without an id are sub-folders (we never create any) or placeholders.
    for (const entry of data) if (entry.id) files.push(`${folder}/${entry.name}`);
    if (data.length < 1000) return files;
  }
}

async function removeFiles(client: Client, paths: string[]): Promise<boolean> {
  for (let i = 0; i < paths.length; i += 1000) {
    const { error } = await client.storage.from(FEATURE_BUCKET).remove(paths.slice(i, i + 1000));
    if (error) {
      console.error("[trash] remove", error.message);
      return false;
    }
  }
  return true;
}

export async function purge(client: Client, items: TrashItems): Promise<PurgeResult> {
  const result: PurgeResult = { templates: 0, variations: 0, failed: 0 };

  const templateIds: string[] = [];
  for (const t of items.templates) {
    const files = await templateFiles(client, t);
    if (files && (await removeFiles(client, files))) templateIds.push(t.id);
    else result.failed++;
  }
  if (templateIds.length > 0) {
    // Still trashed only: a template restored meanwhile is kept. Its variations, tag links
    // and Original go with it through the foreign-key cascades.
    const { data, error } = await client
      .from("templates")
      .delete()
      .in("id", templateIds)
      .not("deleted_at", "is", null)
      .select("id");
    if (error) {
      console.error("[trash] delete templates", error.message);
      result.failed += templateIds.length;
    } else result.templates = data.length;
  }

  const variationIds: string[] = [];
  const paths = items.variations.flatMap((v) => (v.featureImagePath ? [v.featureImagePath] : []));
  if (await removeFiles(client, paths)) variationIds.push(...items.variations.map((v) => v.id));
  else result.failed += items.variations.length;
  if (variationIds.length > 0) {
    const { data, error } = await client
      .from("variations")
      .delete()
      .in("id", variationIds)
      .not("deleted_at", "is", null)
      .eq("is_original", false)
      .select("id");
    if (error) {
      console.error("[trash] delete variations", error.message);
      result.failed += variationIds.length;
    } else result.variations = data.length;
  }
  return result;
}
