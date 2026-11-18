import { getCurrentUser } from "@/lib/auth";
import {
  type FeatureTarget,
  getScreenshotSource,
  saveFeatureImage,
  featureImageUrls,
} from "@/lib/db/feature-images";
import { screenshotToWebp } from "@/lib/images/process";
import { isSameOriginJson } from "@/lib/http";
import { renderScreenshot } from "@/lib/screenshot/render";
import { screenshotRequestSchema } from "@/lib/validation/templates";

// Chrome cold start + 8 s network idle + upload; well under Vercel's limit.
export const maxDuration = 60;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

/**
 * Auto feature image (DEVELOPMENT.md Phase 6): render the Custom template (or one variation) in
 * headless Chrome at 1440×900, store a 1280×800 WebP and point the row at it.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!isSameOriginJson(request)) return json({ ok: false, error: "Bad request." }, 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Bad request." }, 400);
  }
  const parsed = screenshotRequestSchema.safeParse(body);
  if (!parsed.success) return json({ ok: false, error: "Bad request." }, 400);
  const { templateId, variationId, replace } = parsed.data;
  const target: FeatureTarget = variationId
    ? { kind: "variation", templateId, variationId }
    : { kind: "template", templateId };

  const source = await getScreenshotSource(target);
  if (!source.ok) return json({ ok: false, error: source.error }, 500);
  if (!source.data) return json({ ok: false, error: "This template no longer exists." }, 404);
  if (source.data.type !== "custom") {
    return json(
      { ok: false, error: "Elementor templates can't be rendered. Upload an image instead." },
      400,
    );
  }

  let webp: Buffer;
  try {
    webp = await screenshotToWebp(await renderScreenshot(source.data.content));
  } catch (error) {
    console.error("[screenshot] render failed", error instanceof Error ? error.message : error);
    return json(
      { ok: false, error: "Couldn't create the image from the preview. Try again, or upload one." },
      502,
    );
  }

  const saved = await saveFeatureImage({
    ownerId: user.id,
    target,
    webp,
    source: "auto",
    onlyIfEmpty: !replace,
  });
  if (!saved.ok) return json({ ok: false, error: saved.error }, 500);
  if (!saved.data.saved) return json({ ok: true, skipped: true });
  const urls = featureImageUrls([saved.data.path]);
  return json({ ok: true, url: urls.get(saved.data.path) ?? null });
}
