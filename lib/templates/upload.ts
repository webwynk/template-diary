// Template content travels to the server gzip-compressed: Vercel caps request bodies at 4.5 MB,
// while content may be up to 5 MB. HTML and JSON compress 5–10×, so real templates fit easily.

/** Largest compressed upload we send (leaves room under Vercel's 4.5 MB for form overhead). */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** Browser only: gzip `text` (UTF-8) into a Blob. */
export async function gzipText(text: string): Promise<Blob> {
  const stream = new Blob([new TextEncoder().encode(text)])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).blob();
}
