import { FileQuestion } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";

// Any unknown URL (Phase 11). Kept outside the app shell so it never needs a session.
export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <EmptyState
        icon={FileQuestion}
        title="Page not found"
        description="This address doesn't exist in Template Diary."
        className="w-full max-w-md"
        action={
          <Button asChild variant="secondary">
            <Link href="/">Go to library</Link>
          </Button>
        }
      />
    </main>
  );
}
