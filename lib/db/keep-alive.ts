import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * One trivial query so the Free Supabase project counts as active (DEVELOPMENT.md §7
 * "Keep-alive"). No cookies and no session: it runs as anon, which may execute only
 * keep_alive() (returns true, reads no table).
 */
export async function pingDatabase(): Promise<{ ok: true } | { ok: false; error: string }> {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = getPublicEnv();
  const supabase = createClient<Database>(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await supabase.rpc("keep_alive");
  if (error) return { ok: false, error: error.message };
  if (data !== true) return { ok: false, error: "Unexpected keep_alive result" };
  return { ok: true };
}
