import { Suspense } from "react";

import { ContentSkeleton, ShellSkeleton } from "@/components/common/skeletons";
import { AppShell } from "@/components/shell/app-shell";
import { getCurrentUser } from "@/lib/auth";
import { listTagsWithCounts } from "@/lib/db/tags";
import type { TagWithCount } from "@/lib/tags";

// Every page in this group requires the signed-in, allowed user (RULES.md §7).
// The shell never waits on data: the email and the sidebar tags arrive as promises read inside
// their own <Suspense>, and only the page waits for the session check in <Protected>. The outer
// <Suspense> is needed because the shell reads the URL (usePathname). On navigation the shell
// stays on screen and the page's loading.tsx shows at once (speed audit P2).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  // getCurrentUser is cached per request, so this and <Protected> share one check. A failed
  // check only blanks the email here; <Protected> does the redirect.
  const email = getCurrentUser().then(
    (user) => user.email,
    () => "",
  );
  // If tags fail to load, the shell still renders; the tags page shows the error.
  const tags: Promise<TagWithCount[]> = listTagsWithCounts().then(
    (r) => (r.ok ? r.data : []),
    () => [],
  );

  return (
    <Suspense fallback={<ShellSkeleton />}>
      <AppShell email={email} tags={tags}>
        <Suspense fallback={<ContentSkeleton />}>
          <Protected>{children}</Protected>
        </Suspense>
      </AppShell>
    </Suspense>
  );
}

async function Protected({ children }: { children: React.ReactNode }) {
  await getCurrentUser();
  return children;
}
