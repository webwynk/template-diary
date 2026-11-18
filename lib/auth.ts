import "server-only";

import { redirect } from "next/navigation";

import { isAllowedEmail } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
};

/**
 * Data Access Layer entry point: returns the signed-in, allowed user or redirects to /login.
 * Call it in every protected Server Component, Server Action and Route Handler; don't rely on
 * proxy.ts alone (RULES.md §7). It reads cookies, so render callers inside <Suspense>.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const email = typeof claims?.email === "string" ? claims.email : null;

  if (error || !claims?.sub || !email || !isAllowedEmail(email)) {
    redirect("/login");
  }
  return { id: claims.sub, email };
}
