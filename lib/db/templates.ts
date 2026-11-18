import "server-only";

import type { DetectionSummary } from "@/lib/engine";
import { toUserError, type DbResult } from "@/lib/db/result";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import type { TemplateDetails } from "@/lib/validation/templates";
import type { TemplateKind } from "@/lib/engine/types";

// --- Types the UI works with (camelCase, mapped explicitly; RULES.md §4) ---------------------

export interface TemplateListItem {
  id: string;
  name: string;
  type: TemplateKind;
  isFavorite: boolean;
  hasFeatureImage: boolean;
  updatedAt: string;
  tagIds: string[];
  variationCount: number;
}

export interface VariationListItem {
  id: string;
  name: string;
  isOriginal: boolean;
  parentVariationId: string | null;
  usedIn: string | null;
  swatches: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TemplateDetail {
  id: string;
  name: string;
  type: TemplateKind;
  notes: string | null;
  usedIn: string | null;
  isFavorite: boolean;
  hasFeatureImage: boolean;
  createdAt: string;
  updatedAt: string;
  tagIds: string[];
  variations: VariationListItem[];
}

export interface VariationContent {
  content: string;
  variationName: string;
  templateName: string;
  type: TemplateKind;
}

// Postgres foreign_key_violation on template_tags: a tag was deleted (or isn't the user's).
const CREATE_ERRORS = {
  "23503": "One of the selected tags no longer exists. Refresh and try again.",
};

export async function createTemplate(
  details: TemplateDetails,
  content: string,
  detected: DetectionSummary,
): Promise<DbResult<{ id: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_template", {
    p_name: details.name,
    p_type: details.type,
    p_content: content,
    p_tag_ids: details.tagIds,
    ...(details.notes !== null ? { p_notes: details.notes } : {}),
    ...(details.usedIn !== null ? { p_used_in: details.usedIn } : {}),
    p_detected: detected as unknown as Json,
  });
  if (error) return { ok: false, error: toUserError(error, "create_template", CREATE_ERRORS) };
  return { ok: true, data: { id: data } };
}

/** Live (not trashed) templates, most recently edited first. No content is loaded. */
export async function listTemplates(
  filter: { tagId?: string } = {},
): Promise<DbResult<TemplateListItem[]>> {
  const supabase = await createClient();
  const columns =
    "id, name, type, is_favorite, feature_image_path, updated_at, template_tags(tag_id), variations(deleted_at)";
  // Filtering on an "!inner" alias keeps only templates with that tag, while the plain
  // template_tags embed still returns all of their tags for the card.
  const query = filter.tagId
    ? supabase
        .from("templates")
        .select(`${columns}, tag_filter:template_tags!inner(tag_id)`)
        .eq("tag_filter.tag_id", filter.tagId)
    : supabase.from("templates").select(columns);
  const { data, error } = await query
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (error) return { ok: false, error: toUserError(error, "listTemplates") };

  return {
    ok: true,
    data: data.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      isFavorite: row.is_favorite,
      hasFeatureImage: row.feature_image_path !== null,
      updatedAt: row.updated_at,
      tagIds: row.template_tags.map((t) => t.tag_id),
      variationCount: row.variations.filter((v) => v.deleted_at === null).length,
    })),
  };
}

/** One live template with its live variations (Original first). `null` when not found. */
export async function getTemplate(id: string): Promise<DbResult<TemplateDetail | null>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("templates")
    .select(
      "id, name, type, notes, used_in, is_favorite, feature_image_path, created_at, updated_at, template_tags(tag_id), variations!variations_template_id_owner_id_fkey(id, name, is_original, parent_variation_id, used_in, detected, deleted_at, created_at, updated_at)",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return { ok: false, error: toUserError(error, "getTemplate") };
  if (!data) return { ok: true, data: null };

  const variations = data.variations
    .filter((v) => v.deleted_at === null)
    .map((v) => ({
      id: v.id,
      name: v.name,
      isOriginal: v.is_original,
      parentVariationId: v.parent_variation_id,
      usedIn: v.used_in,
      swatches: swatchesFrom(v.detected),
      createdAt: v.created_at,
      updatedAt: v.updated_at,
    }))
    .sort(
      (a, b) =>
        Number(b.isOriginal) - Number(a.isOriginal) || b.updatedAt.localeCompare(a.updatedAt),
    );

  return {
    ok: true,
    data: {
      id: data.id,
      name: data.name,
      type: data.type,
      notes: data.notes,
      usedIn: data.used_in,
      isFavorite: data.is_favorite,
      hasFeatureImage: data.feature_image_path !== null,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      tagIds: data.template_tags.map((t) => t.tag_id),
      variations,
    },
  };
}

/** The exact saved content of a live variation, for Copy code / Download. `null` when not found. */
export async function getVariationContent(id: string): Promise<DbResult<VariationContent | null>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("variations")
    .select("content, name, templates!variations_template_id_owner_id_fkey(name, type, deleted_at)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return { ok: false, error: toUserError(error, "getVariationContent") };
  if (!data || !data.templates || data.templates.deleted_at !== null)
    return { ok: true, data: null };
  return {
    ok: true,
    data: {
      content: data.content,
      variationName: data.name,
      templateName: data.templates.name,
      type: data.templates.type,
    },
  };
}

/**
 * Top colors from a cached detection summary (variations.detected). The cache is only for
 * display, so anything unexpected just yields no swatches.
 */
export function swatchesFrom(detected: Json, max = 6): string[] {
  if (typeof detected !== "object" || detected === null || Array.isArray(detected)) return [];
  const colors = detected.colors;
  if (!Array.isArray(colors)) return [];
  const out: string[] = [];
  for (const c of colors) {
    if (typeof c !== "object" || c === null || Array.isArray(c)) continue;
    const rgb = c.rgb;
    if (typeof rgb === "string" && /^#[0-9a-f]{6}$/.test(rgb)) out.push(rgb);
    if (out.length === max) break;
  }
  return out;
}
