import { timingSafeEqual } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { expired, findTrash, purge } from "@/lib/trash/purge";

// Daily trash purge (DEVELOPMENT.md Phase 9), called by Vercel Cron (vercel.json) with
// `Authorization: Bearer $CRON_SECRET`. Deletes Storage files first, then the rows of templates
// and variations that have been in the trash longer than each user's trash_retention_days.

export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error("[cron] purge-trash", (error as Error).message);
    return Response.json({ error: "Not configured" }, { status: 500 });
  }

  const [trash, settings] = await Promise.all([
    findTrash(admin),
    admin.from("user_settings").select("owner_id, trash_retention_days"),
  ]);
  if (!trash.ok || settings.error) {
    console.error("[cron] purge-trash read", settings.error?.message);
    return Response.json({ error: "Couldn't read the trash" }, { status: 500 });
  }
  const days = new Map(settings.data.map((s) => [s.owner_id, s.trash_retention_days]));
  const result = await purge(admin, expired(trash.data, days, new Date()));
  console.info("[cron] purge-trash", JSON.stringify(result));
  return Response.json(result, { status: result.failed > 0 ? 500 : 200 });
}
