import { Suspense } from "react";

import { EditorSkeleton } from "@/components/common/skeletons";
import { getCurrentUser } from "@/lib/auth";

// Full-screen editor without the app shell (DESIGN.md §7.5). Same protection as (app): the
// signed-in, allowed user is checked here and again in every action (RULES.md §7).
export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <Protected>{children}</Protected>
    </Suspense>
  );
}

async function Protected({ children }: { children: React.ReactNode }) {
  await getCurrentUser();
  return children;
}
