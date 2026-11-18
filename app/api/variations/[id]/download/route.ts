import { getCurrentUser } from "@/lib/auth";
import { getVariationContent } from "@/lib/db/templates";
import { downloadFilename } from "@/lib/templates/filename";
import { idSchema } from "@/lib/validation/templates";

/**
 * Download a variation's content exactly as saved (byte for byte), e.g. an Elementor .json
 * export. Auth is checked here as well as in proxy.ts (RULES.md §7).
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/variations/[id]/download">) {
  await getCurrentUser();
  const { id } = await ctx.params;
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return new Response("Not found", { status: 404 });

  const result = await getVariationContent(parsed.data);
  if (!result.ok) return new Response(result.error, { status: 500 });
  if (!result.data) return new Response("Not found", { status: 404 });

  const filename = downloadFilename(
    result.data.templateName,
    result.data.variationName,
    result.data.type,
  );
  return new Response(result.data.content, {
    headers: {
      "Content-Type":
        result.data.type === "elementor"
          ? "application/json; charset=utf-8"
          : "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
