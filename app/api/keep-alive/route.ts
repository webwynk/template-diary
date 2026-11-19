import { connection } from "next/server";

import { pingDatabase } from "@/lib/db/keep-alive";

// Called once a day by Vercel Cron (vercel.json) so the Free Supabase project isn't paused.
// Deliberately public (DEVELOPMENT.md §7 "Keep-alive"): no input, no data in the answer, one
// trivial anon query. proxy.ts skips this path.
export async function GET() {
  await connection();
  let ok = false;
  try {
    const result = await pingDatabase();
    ok = result.ok;
    if (!result.ok) console.error("keep-alive failed:", result.error);
  } catch (error) {
    console.error("keep-alive failed:", error);
  }
  return Response.json(
    { ok },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
