import "server-only";

import type { DetectionSummary } from "@/lib/engine";
import { signFeatureImages } from "@/lib/db/feature-images";
import { toUserError, type DbResult } from "@/lib/db/result";
import { createClient } from "@/lib/supabase/server";
import { changesSummary } from "@/lib/templates/changes";
import type { Json } from "@/types/database";
import type { TemplateDetails } from "@/lib/validation/templates";
import type { TemplateKind } from "@/lib/engine/types";

// --- Types the UI works with (camelCase, mapped explicitly; RULES.md §4) ---------------------

export interface TemplateListItem {
  id: string;
  name: string;
  type: TemplateKind;
  isFavorite: boolean;
  /** Signed URL of the feature image (1 h), or null for the placeholder. */
  featureImageUrl: string | null;
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
  /** "2 colors changed, code edited"; empty for the Original. */
  summary: string;
  /** The variation's own image (signed URL); null means it uses the template image. */
  featureImageUrl: string | null;
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
  featureImageUrl: string | null;
  featureImageSource: "none" | "auto" | "upload";
  createdAt: string;
  updatedAt: string;
  tagIds: string[];
  variations: VariationListItem[];
  /** Trashed variations, newest first (restorable until the trash is purged). */
  trashedVariations: { id: string; name: string; deletedAt: string }[];
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

  const urls = await signFeatureImages(data.map((row) => row.feature_image_path));
  return {
    ok: true,
    data: data.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      isFavorite: row.is_favorite,
      featureImageUrl: (row.feature_image_path && urls.get(row.feature_image_path)) || null,
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
      "id, name, type, notes, used_in, is_favorite, feature_image_path, feature_image_source, created_at, updated_at, template_tags(tag_id), variations!variations_template_id_owner_id_fkey(id, name, is_original, parent_variation_id, used_in, detected, changes, feature_image_path, deleted_at, created_at, updated_at)",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return { ok: false, error: toUserError(error, "getTemplate") };
  if (!data) return { ok: true, data: null };

  const live = data.variations.filter((v) => v.deleted_at === null);
  const urls = await signFeatureImages([
    data.feature_image_path,
    ...live.map((v) => v.feature_image_path),
  ]);
  const signed = (path: string | null) => (path && urls.get(path)) || null;
  const variations = live
    .map((v) => ({
      id: v.id,
      name: v.name,
      isOriginal: v.is_original,
      parentVariationId: v.parent_variation_id,
      usedIn: v.used_in,
      swatches: swatchesFrom(v.detected),
      summary: v.is_original ? "" : changesSummary(v.changes),
      featureImageUrl: signed(v.feature_image_path),
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
      featureImageUrl: signed(data.feature_image_path),
      featureImageSource: data.feature_image_source,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      tagIds: data.template_tags.map((t) => t.tag_id),
      variations,
      trashedVariations: data.variations
        .filter((v): v is typeof v & { deleted_at: string } => v.deleted_at !== null)
        .map((v) => ({ id: v.id, name: v.name, deletedAt: v.deleted_at }))
        .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)),
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

// --- Editor ----------------------------------------------------------------------------------

export interface HistoryItem {
  id: string;
  name: string;
  isOriginal: boolean;
  parentVariationId: string | null;
  swatches: string[];
  summary: string;
  createdAt: string;
  updatedAt: string;
}

export interface EditorData {
  template: { id: string; name: string; type: TemplateKind };
  /** Live variations for the Base menu and the History sheet (Original first, then newest). */
  variations: HistoryItem[];
  base: {
    id: string;
    name: string;
    isOriginal: boolean;
    content: string;
    /** Changes when the variation is saved in place, so the editor restarts from the new code. */
    updatedAt: string;
  };
  /** The base variation's image, else the template's (signed URL), for Elementor's preview pane. */
  featureImageUrl: string | null;
}

/**
 * Template + live variation names + the content of the base variation (default: the Original).
 * `null` when the template or the requested base doesn't exist (or is trashed).
 */
export async function getEditorData(
  templateId: string,
  baseId?: string,
): Promise<DbResult<EditorData | null>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("templates")
    .select(
      "id, name, type, feature_image_path, variations!variations_template_id_owner_id_fkey(id, name, is_original, parent_variation_id, detected, changes, feature_image_path, deleted_at, created_at, updated_at)",
    )
    .eq("id", templateId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return { ok: false, error: toUserError(error, "getEditorData") };
  if (!data) return { ok: true, data: null };

  const live = data.variations
    .filter((v) => v.deleted_at === null)
    .sort(
      (a, b) =>
        Number(b.is_original) - Number(a.is_original) || b.updated_at.localeCompare(a.updated_at),
    );
  const baseRow = baseId ? live.find((v) => v.id === baseId) : live.find((v) => v.is_original);
  if (!baseRow) return { ok: true, data: null };

  const content = await supabase
    .from("variations")
    .select("content")
    .eq("id", baseRow.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (content.error)
    return { ok: false, error: toUserError(content.error, "getEditorData.content") };
  if (!content.data) return { ok: true, data: null };

  const imagePath = baseRow.feature_image_path ?? data.feature_image_path;
  const urls = await signFeatureImages([imagePath]);
  return {
    ok: true,
    data: {
      template: { id: data.id, name: data.name, type: data.type },
      variations: live.map((v) => ({
        id: v.id,
        name: v.name,
        isOriginal: v.is_original,
        parentVariationId: v.parent_variation_id,
        swatches: swatchesFrom(v.detected),
        summary: v.is_original ? "" : changesSummary(v.changes),
        createdAt: v.created_at,
        updatedAt: v.updated_at,
      })),
      base: {
        id: baseRow.id,
        name: baseRow.name,
        isOriginal: baseRow.is_original,
        content: content.data.content,
        updatedAt: baseRow.updated_at,
      },
      featureImageUrl: (imagePath && urls.get(imagePath)) || null,
    },
  };
}

/** Content + template of a live variation that belongs to `templateId` (for saving a new one). */
export async function getBaseForSave(
  templateId: string,
  variationId: string,
): Promise<DbResult<{ content: string; type: TemplateKind } | null>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("variations")
    .select(
      "content, template_id, templates!variations_template_id_owner_id_fkey(type, deleted_at)",
    )
    .eq("id", variationId)
    .eq("template_id", templateId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return { ok: false, error: toUserError(error, "getBaseForSave") };
  if (!data || !data.templates || data.templates.deleted_at !== null)
    return { ok: true, data: null };
  return { ok: true, data: { content: data.content, type: data.templates.type } };
}

// Postgres unique_violation on the live-name index (case/space-insensitive, "Original" reserved).
export const VARIATION_NAME_TAKEN = "This template already has a variation with that name.";
const VARIATION_ERRORS = { "23505": VARIATION_NAME_TAKEN };

export interface NewVariation {
  templateId: string;
  parentVariationId: string;
  name: string;
  usedIn: string | null;
  content: string;
  detected: DetectionSummary;
  changes: unknown[];
}

/** Insert a new variation (append-only history; the base is never modified). */
export async function insertVariation(v: NewVariation): Promise<DbResult<{ id: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("variations")
    .insert({
      template_id: v.templateId,
      parent_variation_id: v.parentVariationId,
      name: v.name,
      used_in: v.usedIn,
      content: v.content,
      detected: v.detected as unknown as Json,
      changes: v.changes as Json,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: toUserError(error, "insertVariation", VARIATION_ERRORS) };
  return { ok: true, data };
}

/** A live, non-Original variation of `templateId` with its content (for saving in place). */
export async function getVariationForUpdate(
  templateId: string,
  variationId: string,
): Promise<
  DbResult<{ content: string; changes: Json; type: TemplateKind; isOriginal: boolean } | null>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("variations")
    .select(
      "content, changes, is_original, templates!variations_template_id_owner_id_fkey(type, deleted_at)",
    )
    .eq("id", variationId)
    .eq("template_id", templateId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return { ok: false, error: toUserError(error, "getVariationForUpdate") };
  if (!data || !data.templates || data.templates.deleted_at !== null)
    return { ok: true, data: null };
  return {
    ok: true,
    data: {
      content: data.content,
      changes: data.changes,
      type: data.templates.type,
      isOriginal: data.is_original,
    },
  };
}

/**
 * Overwrite a variation's code (Hasan's decision, 2026-11-18). Only if the row is unchanged
 * since the editor loaded it (same updated_at), so two tabs can't silently overwrite each other.
 * The database refuses the Original. Returns false when nothing matched (changed or deleted).
 */
export async function updateVariationContent(v: {
  templateId: string;
  variationId: string;
  expectedUpdatedAt: string;
  content: string;
  detected: DetectionSummary;
  changes: unknown[];
}): Promise<DbResult<boolean>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("variations")
    .update({
      content: v.content,
      detected: v.detected as unknown as Json,
      changes: v.changes as Json,
    })
    .eq("id", v.variationId)
    .eq("template_id", v.templateId)
    .eq("is_original", false)
    .eq("updated_at", v.expectedUpdatedAt)
    .is("deleted_at", null)
    .select("id");
  if (error) return { ok: false, error: toUserError(error, "updateVariationContent") };
  return { ok: true, data: data.length > 0 };
}
