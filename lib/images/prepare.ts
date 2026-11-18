// Prepare a picked image for upload in the browser (DEVELOPMENT.md Phase 6). The server checks
// and re-encodes it again; this step only keeps requests under Vercel's 4.5 MB body limit.

export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const MAX_PICK_BYTES = 5 * 1024 * 1024;
/** What we send: well under the 4.5 MB request limit. */
export const MAX_SEND_BYTES = 4 * 1024 * 1024;
const MAX_WIDTH = 1600;
const MAX_HEIGHT = 4000;

export type PreparedImage = { ok: true; blob: Blob } | { ok: false; error: string };

export function checkPickedImage(file: File): string | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "Use a PNG, JPG or WebP image.";
  }
  if (file.size > MAX_PICK_BYTES) return "Images can be at most 5 MB.";
  if (file.size === 0) return "The file is empty.";
  return null;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Validate, then downscale to at most 1600 px wide (and 4000 px tall) as WebP or JPEG. */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const problem = checkPickedImage(file);
  if (problem) return { ok: false, error: problem };

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Can't decode here (old browser or broken file): let the server decide if it's small enough.
    return file.size <= MAX_SEND_BYTES
      ? { ok: true, blob: file }
      : { ok: false, error: "This image couldn't be read. Try another PNG, JPG or WebP file." };
  }
  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.min(MAX_HEIGHT, Math.round(bitmap.height * scale)));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file.size <= MAX_SEND_BYTES
      ? { ok: true, blob: file }
      : { ok: false, error: "Couldn't prepare the image." };
  }
  ctx.fillStyle = "#ffffff"; // transparent areas become white, like on a card
  ctx.fillRect(0, 0, width, height);
  // Taller images keep their top part (cards show the top of the image).
  ctx.drawImage(bitmap, 0, 0, bitmap.width * scale, bitmap.height * scale);
  bitmap.close();

  // Safari can't encode WebP and silently returns PNG; fall back to JPEG then.
  let blob = await toBlob(canvas, "image/webp", 0.85);
  if (!blob || blob.type !== "image/webp" || blob.size > MAX_SEND_BYTES) {
    blob = await toBlob(canvas, "image/jpeg", 0.85);
  }
  if (!blob || blob.size > MAX_SEND_BYTES) {
    return { ok: false, error: "This image is too large. Try a smaller one." };
  }
  return { ok: true, blob };
}

/** Ask the server to (re)generate the image from the desktop preview. */
export async function requestScreenshot(body: {
  templateId: string;
  variationId?: string;
  replace: boolean;
}): Promise<{ ok: true; url: string | null } | { ok: false; error: string }> {
  try {
    const response = await fetch("/api/screenshot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => null)) as
      { ok: true; url?: string | null } | { ok: false; error: string } | null;
    if (!data) return { ok: false, error: "Couldn't create the image. Try again." };
    return data.ok ? { ok: true, url: data.url ?? null } : data;
  } catch {
    return { ok: false, error: "Couldn't create the image. Check your connection and try again." };
  }
}
