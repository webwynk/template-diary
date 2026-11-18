import "server-only";

import sharp from "sharp";

// Feature image processing (DEVELOPMENT.md Phase 6, RULES.md §7). Everything stored is a WebP we
// encoded ourselves, so uploaded files never reach Storage as-is (no metadata, no polyglots).

export const FEATURE_WIDTH = 1280;
export const FEATURE_HEIGHT = 800;
/** Uploads may be taller than 16:10 (full-page shots); keep at most this much from the top. */
const MAX_UPLOAD_HEIGHT = 3200;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_INPUT_PIXELS = 40_000_000;

export type ImageKind = "png" | "jpeg" | "webp";

/** Detect PNG / JPEG / WebP from the file's first bytes (the declared MIME type is not trusted). */
export function sniffImage(bytes: Uint8Array): ImageKind | null {
  const b = bytes;
  if (
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  )
    return "png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (
    b.length >= 12 &&
    String.fromCharCode(b[0]!, b[1]!, b[2]!, b[3]!) === "RIFF" &&
    String.fromCharCode(b[8]!, b[9]!, b[10]!, b[11]!) === "WEBP"
  )
    return "webp";
  return null;
}

/** Screenshot PNG (1440×900) → 1280×800 WebP. */
export async function screenshotToWebp(png: Buffer): Promise<Buffer> {
  return sharp(png)
    .resize(FEATURE_WIDTH, FEATURE_HEIGHT, { fit: "cover", position: "top" })
    .webp({ quality: 80 })
    .toBuffer();
}

export class ImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageError";
  }
}

/**
 * Validate an uploaded image and re-encode it: at most 1280 px wide (never enlarged), at most
 * 3200 px tall (cropped from the top), WebP, metadata stripped.
 */
export async function processUpload(bytes: Buffer): Promise<Buffer> {
  if (bytes.byteLength === 0) throw new ImageError("The file is empty.");
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new ImageError("Images can be at most 5 MB.");
  if (!sniffImage(bytes)) throw new ImageError("Use a PNG, JPG or WebP image.");
  try {
    const resized = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, animated: false })
      .rotate() // apply EXIF orientation before metadata is dropped
      .resize({ width: FEATURE_WIDTH, withoutEnlargement: true })
      .png()
      .toBuffer({ resolveWithObject: true });
    const { width, height } = resized.info;
    const image = sharp(resized.data);
    if (height > MAX_UPLOAD_HEIGHT) {
      image.extract({ left: 0, top: 0, width, height: MAX_UPLOAD_HEIGHT });
    }
    return await image.webp({ quality: 82 }).toBuffer();
  } catch {
    throw new ImageError("This image couldn't be read. Try another PNG, JPG or WebP file.");
  }
}
