import { Suspense } from "react";

import { signOut } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";

// Every page in this group requires the signed-in, allowed user. The full app shell
// (sidebar, top bar) arrives in Phase 2; this is the minimal protected frame.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AppLoading />}>
      <Protected>{children}</Protected>
    </Suspense>
  );
}

async function Protected({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-background px-4 md:px-6 lg:px-8">
        <span className="text-base font-semibold">Template Diary</span>
        <div className="flex min-w-0 items-center gap-3">
          <span className="truncate text-[13px] text-muted-foreground">{user.email}</span>
          <form action={signOut}>
            <Button type="submit" variant="secondary" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}

function AppLoading() {
  return (
    <div className="flex flex-1 items-center justify-center" role="status" aria-label="Loading">
      <div className="size-6 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  );
}
