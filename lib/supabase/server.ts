import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";

import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Create a new one per request; never share it. Runs as the signed-in user, so RLS applies.
 */
export async function createClient() {
  const cookieStore = await cookies();
  // Supabase reads the clock (token expiry) and makes network calls, which Next.js doesn't
  // allow while it prerenders the session App Shell for a prefetch. Stop the prerender here:
  // data always loads at request time, inside the pages' loading boundaries.
  await connection();
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = getPublicEnv();

  return createServerClient<Database>(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components can't set cookies. That's fine: proxy.ts refreshes the
          // session on every request, so the cookies are written there instead.
        }
      },
    },
  });
}
