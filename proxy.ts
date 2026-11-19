import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Everything except Next.js internals, static files and the public keep-alive ping
  // (DEVELOPMENT.md §7 "Keep-alive"), which must not be redirected to /login.
  matcher: [
    "/((?!_next/static|_next/image|monaco/|api/keep-alive$|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
