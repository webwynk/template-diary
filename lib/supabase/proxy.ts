import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getPublicEnv, isAllowedEmail } from "@/lib/env";
import type { Database } from "@/types/database";

const PUBLIC_PATHS = ["/login"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Runs on every request (see /proxy.ts): refreshes the Supabase session cookies and does the
 * optimistic redirects. This is NOT the security boundary; RLS and the checks in
 * lib/auth.ts and every Server Action are (RULES.md §7).
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  // The cron route has no session; it checks CRON_SECRET itself.
  if (request.nextUrl.pathname.startsWith("/api/cron/")) return NextResponse.next({ request });
  let response = NextResponse.next({ request });
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = getPublicEnv();

  const supabase = createServerClient<Database>(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
        },
      },
    },
  );

  // Do not run code between createServerClient and getClaims(): getClaims() validates the
  // token and triggers the refresh that writes new cookies.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const email = typeof claims?.email === "string" ? claims.email : null;
  const { pathname } = request.nextUrl;

  // A session for any account other than ALLOWED_EMAIL is signed out immediately.
  if (claims && !isAllowedEmail(email)) {
    await supabase.auth.signOut();
    return redirectWithCookies(request, response, "/login?error=not-allowed");
  }

  if (!claims && !isPublicPath(pathname)) {
    return redirectWithCookies(request, response, "/login");
  }

  if (claims && isPublicPath(pathname)) {
    return redirectWithCookies(request, response, "/");
  }

  return response;
}

/** Redirect while keeping any auth cookies that were just refreshed or cleared. */
function redirectWithCookies(request: NextRequest, from: NextResponse, to: string): NextResponse {
  const redirect = NextResponse.redirect(new URL(to, request.url));
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  from.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "location" && key.toLowerCase() !== "set-cookie") {
      redirect.headers.set(key, value);
    }
  });
  return redirect;
}
