import "server-only";

import { gunzipSync } from "node:zlib";

import { MAX_CONTENT_BYTES } from "@/lib/engine/types";
import { MAX_UPLOAD_BYTES } from "@/lib/templates/upload";

/**
 * Unpack content sent by gzipText. Returns null for anything that isn't a gzip of valid UTF-8
 * text within the size limits (the output cap also stops "zip bombs").
 */
export async function gunzipUpload(file: FormDataEntryValue | Blob | null): Promise<string | null> {
  if (!(file instanceof Blob) || file.size === 0 || file.size > MAX_UPLOAD_BYTES) return null;
  try {
    const bytes = gunzipSync(Buffer.from(await file.arrayBuffer()), {
      maxOutputLength: MAX_CONTENT_BYTES,
    });
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return null;
  }
}
