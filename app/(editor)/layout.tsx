import { Suspense } from "react";

import { getCurrentUser } from "@/lib/auth";

// Full-screen editor without the app shell (DESIGN.md §7.5). Same protection as (app): the
// signed-in, allowed user is checked here and again in every action (RULES.md §7).
export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<EditorLoading />}>
      <Protected>{children}</Protected>
    </Suspense>
  );
}

async function Protected({ children }: { children: React.ReactNode }) {
  await getCurrentUser();
  return children;
}

function EditorLoading() {
  return (
    <div className="flex h-dvh items-center justify-center" role="status" aria-label="Loading">
      <div className="size-6 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  );
}
