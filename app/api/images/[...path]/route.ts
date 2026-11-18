import { getCurrentUser } from "@/lib/auth";
import { FEATURE_IMAGE_PATH_RE, readFeatureImage } from "@/lib/db/feature-images";

// Feature images, served from our own domain (speed audit P4). Every stored file has its own
// unique name ({owner}/{template}/{id}-{unix_ms}.webp) and a new image always gets a new name,
// so the browser may keep a file forever: a second visit loads no thumbnails at all.
// Private: only the signed-in owner can read their files (checked here, and by Storage RLS).

const CACHE = "private, max-age=31536000, immutable";

export async function GET(_request: Request, ctx: RouteContext<"/api/images/[...path]">) {
  const user = await getCurrentUser();
  const path = (await ctx.params).path.join("/");
  if (!FEATURE_IMAGE_PATH_RE.test(path) || !path.startsWith(`${user.id}/`)) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const file = await readFeatureImage(path);
  if (!file) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return new Response(file, {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(file.size),
      "Cache-Control": CACHE,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
