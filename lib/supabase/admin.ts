import "server-only";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Service-role client: bypasses RLS. Only for the trash purge cron (RULES.md §11).
 * Never import it from a component, a Server Action or anything a user request can reach.
 */
export function createAdminClient() {
  const key = z.string().min(20).safeParse(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!key.success) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY (server only).");
  return createClient<Database>(getPublicEnv().NEXT_PUBLIC_SUPABASE_URL, key.data, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
