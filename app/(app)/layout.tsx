import { Suspense } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { getCurrentUser } from "@/lib/auth";
import { listTagsWithCounts } from "@/lib/db/tags";

// Every page in this group requires the signed-in, allowed user (RULES.md §7).
// The session read happens inside <Suspense> as Cache Components requires.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AppLoading />}>
      <Protected>{children}</Protected>
    </Suspense>
  );
}

async function Protected({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const tags = await listTagsWithCounts();

  // If tags fail to load, the shell still renders; the tags page shows the error.
  return (
    <AppShell email={user.email} tags={tags.ok ? tags.data : []}>
      {children}
    </AppShell>
  );
}

function AppLoading() {
  return (
    <div className="flex flex-1 items-center justify-center" role="status" aria-label="Loading">
      <div className="size-6 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  );
}
