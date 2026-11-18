"use server";

import { refresh } from "next/cache";

import { getCurrentUser } from "@/lib/auth";
import * as featureImages from "@/lib/db/feature-images";
import { ImageError, MAX_IMAGE_BYTES, processUpload } from "@/lib/images/process";
import { featureTargetSchema } from "@/lib/validation/templates";

export type FeatureImageResult = { ok: true; url: string | null } | { ok: false; error: string };

function target(formData: FormData) {
  const field = (name: string) => {
    const v = formData.get(name);
    return typeof v === "string" && v !== "" ? v : undefined;
  };
  const parsed = featureTargetSchema.safeParse({
    templateId: field("templateId"),
    variationId: field("variationId"),
  });
  if (!parsed.success) return null;
  const { templateId, variationId } = parsed.data;
  return variationId
    ? ({ kind: "variation", templateId, variationId } as const)
    : ({ kind: "template", templateId } as const);
}

/**
 * Manual feature image (DEVELOPMENT.md Phase 6): PNG/JPG/WebP up to 5 MB, checked by content
 * (not the declared type) and re-encoded to WebP on the server before it is stored (RULES.md §7).
 */
export async function uploadFeatureImageAction(formData: FormData): Promise<FeatureImageResult> {
  const user = await getCurrentUser();
  const t = target(formData);
  if (!t) return { ok: false, error: "This template no longer exists." };

  const file = formData.get("image");
  if (!(file instanceof Blob)) return { ok: false, error: "Choose an image to upload." };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "Images can be at most 5 MB." };

  let webp: Buffer;
  try {
    webp = await processUpload(Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    if (error instanceof ImageError) return { ok: false, error: error.message };
    throw error;
  }

  const saved = await featureImages.saveFeatureImage({
    ownerId: user.id,
    target: t,
    webp,
    source: "upload",
  });
  if (!saved.ok) return saved;
  refresh();
  if (!saved.data.saved) return { ok: true, url: null };
  const urls = featureImages.featureImageUrls([saved.data.path]);
  return { ok: true, url: urls.get(saved.data.path) ?? null };
}

/** Remove a feature image: the template shows its placeholder, a variation the template image. */
export async function removeFeatureImageAction(formData: FormData): Promise<FeatureImageResult> {
  await getCurrentUser();
  const t = target(formData);
  if (!t) return { ok: false, error: "This template no longer exists." };
  const result = await featureImages.removeFeatureImage(t);
  if (!result.ok) return result;
  refresh();
  return { ok: true, url: null };
}
