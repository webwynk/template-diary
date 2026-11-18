import "server-only";

import { toUserError, type DbResult } from "@/lib/db/result";
import type { TemplateKind } from "@/lib/engine/types";
import { createClient } from "@/lib/supabase/server";

// Feature images in Storage (DEVELOPMENT.md §5.5): private bucket, one folder per user,
// `{owner_id}/{template_id}/{template|variation_id}-{unix_ms}.webp`, shown through
// /api/images/<path> (cached by the browser; see app/api/images/[...path]/route.ts).

export const FEATURE_BUCKET = "feature-images";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
/** The only file names featureImagePath() produces. */
export const FEATURE_IMAGE_PATH_RE = new RegExp(`^${UUID}/${UUID}/${UUID}-\\d{10,16}\\.webp$`);

/** A template's own image, or the image of one of its variations. */
export type FeatureTarget =
  | { kind: "template"; templateId: string }
  | { kind: "variation"; templateId: string; variationId: string };

export function featureImagePath(ownerId: string, target: FeatureTarget, now = Date.now()): string {
  const id = target.kind === "template" ? target.templateId : target.variationId;
  return `${ownerId}/${target.templateId}/${id}-${now}.webp`;
}

/**
 * Browser URLs for stored paths: a stable link on our own site, so thumbnails are cached and no
 * request to Storage is needed to build it. Empty and unknown paths are left out.
 */
export function featureImageUrls(paths: (string | null | undefined)[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const p of paths) {
    if (typeof p === "string" && FEATURE_IMAGE_PATH_RE.test(p)) out.set(p, `/api/images/${p}`);
  }
  return out;
}

/** The stored file for /api/images, read as the signed-in user (Storage RLS applies). */
export async function readFeatureImage(path: string): Promise<Blob | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(FEATURE_BUCKET).download(path);
  if (error || !data) {
    if (error) console.error("[storage] readFeatureImage", error.message);
    return null;
  }
  return data;
}

export interface ScreenshotSource {
  type: TemplateKind;
  content: string;
}

/**
 * The content to screenshot for a target: the variation's, or the template's Original.
 * `null` when the template or variation doesn't exist (or is trashed).
 */
export async function getScreenshotSource(
  target: FeatureTarget,
): Promise<DbResult<ScreenshotSource | null>> {
  const supabase = await createClient();
  const query = supabase
    .from("variations")
    .select("content, templates!variations_template_id_owner_id_fkey(type, deleted_at)")
    .eq("template_id", target.templateId)
    .is("deleted_at", null);
  const { data, error } = await (
    target.kind === "variation" ? query.eq("id", target.variationId) : query.eq("is_original", true)
  ).maybeSingle();
  if (error) return { ok: false, error: toUserError(error, "getScreenshotSource") };
  if (!data || !data.templates || data.templates.deleted_at !== null)
    return { ok: true, data: null };
  return { ok: true, data: { type: data.templates.type, content: data.content } };
}

async function currentPath(
  target: FeatureTarget,
): Promise<DbResult<{ path: string | null; source: string } | null>> {
  const supabase = await createClient();
  if (target.kind === "template") {
    const { data, error } = await supabase
      .from("templates")
      .select("feature_image_path, feature_image_source")
      .eq("id", target.templateId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) return { ok: false, error: toUserError(error, "featureImage.current") };
    return {
      ok: true,
      data: data ? { path: data.feature_image_path, source: data.feature_image_source } : null,
    };
  }
  const { data, error } = await supabase
    .from("variations")
    .select("feature_image_path")
    .eq("id", target.variationId)
    .eq("template_id", target.templateId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return { ok: false, error: toUserError(error, "featureImage.current") };
  return {
    ok: true,
    data: data
      ? { path: data.feature_image_path, source: data.feature_image_path ? "auto" : "none" }
      : null,
  };
}

/** Point the row at `next` (or clear it) only if it still points at `expected`. Returns rows changed. */
async function swapPath(
  target: FeatureTarget,
  expected: string | null,
  next: { path: string; source: "auto" | "upload" } | null,
  onlyIfEmpty: boolean,
): Promise<DbResult<number>> {
  const supabase = await createClient();
  if (target.kind === "template") {
    let query = supabase
      .from("templates")
      .update(
        next
          ? { feature_image_path: next.path, feature_image_source: next.source }
          : { feature_image_path: null, feature_image_source: "none" as const },
      )
      .eq("id", target.templateId)
      .is("deleted_at", null);
    query =
      expected === null
        ? query.is("feature_image_path", null)
        : query.eq("feature_image_path", expected);
    if (onlyIfEmpty) query = query.eq("feature_image_source", "none");
    const { data, error } = await query.select("id");
    if (error) return { ok: false, error: toUserError(error, "featureImage.update") };
    return { ok: true, data: data.length };
  }
  let query = supabase
    .from("variations")
    .update({ feature_image_path: next ? next.path : null })
    .eq("id", target.variationId)
    .eq("template_id", target.templateId)
    .is("deleted_at", null);
  query =
    expected === null
      ? query.is("feature_image_path", null)
      : query.eq("feature_image_path", expected);
  const { data, error } = await query.select("id");
  if (error) return { ok: false, error: toUserError(error, "featureImage.update") };
  return { ok: true, data: data.length };
}

async function removeFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const supabase = await createClient();
  const { error } = await supabase.storage.from(FEATURE_BUCKET).remove(paths);
  // A leftover file only costs storage; the trash purge (Phase 9) removes the folder anyway.
  if (error) console.error("[storage] removeFiles", error.message);
}

export type SaveImageResult = { saved: true; path: string } | { saved: false };

/**
 * Upload a WebP and point the row at it, then delete the image it replaces.
 * `onlyIfEmpty` (automatic images after creating) never replaces an image that exists, e.g. one
 * uploaded while the screenshot was rendering; the new file is removed again in that case.
 */
export async function saveFeatureImage(input: {
  ownerId: string;
  target: FeatureTarget;
  webp: Buffer;
  source: "auto" | "upload";
  onlyIfEmpty?: boolean;
}): Promise<DbResult<SaveImageResult>> {
  const current = await currentPath(input.target);
  if (!current.ok) return current;
  if (!current.data) return { ok: false, error: "This template no longer exists." };
  if (input.onlyIfEmpty && current.data.path !== null) return { ok: true, data: { saved: false } };

  const path = featureImagePath(input.ownerId, input.target);
  const supabase = await createClient();
  const upload = await supabase.storage.from(FEATURE_BUCKET).upload(path, input.webp, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: false,
  });
  if (upload.error) {
    console.error("[storage] upload", upload.error.message);
    return { ok: false, error: "Couldn't save the image. Please try again." };
  }

  const changed = await swapPath(
    input.target,
    current.data.path,
    { path, source: input.source },
    input.onlyIfEmpty ?? false,
  );
  if (!changed.ok || changed.data === 0) {
    await removeFiles([path]);
    if (!changed.ok) return changed;
    if (input.onlyIfEmpty) return { ok: true, data: { saved: false } };
    return { ok: false, error: "The image was changed somewhere else. Refresh and try again." };
  }
  if (current.data.path) await removeFiles([current.data.path]);
  return { ok: true, data: { saved: true, path } };
}

/** Remove the image (back to the placeholder, or to the template image for a variation). */
export async function removeFeatureImage(target: FeatureTarget): Promise<DbResult<null>> {
  const current = await currentPath(target);
  if (!current.ok) return current;
  if (!current.data) return { ok: false, error: "This template no longer exists." };
  if (current.data.path === null) return { ok: true, data: null };
  const changed = await swapPath(target, current.data.path, null, false);
  if (!changed.ok) return changed;
  if (changed.data > 0) await removeFiles([current.data.path]);
  return { ok: true, data: null };
}
