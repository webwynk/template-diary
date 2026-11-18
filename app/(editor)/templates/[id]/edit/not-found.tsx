import { FileQuestion } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";

export default function EditorNotFound() {
  return (
    <div className="flex h-dvh items-center justify-center p-6">
      <EmptyState
        icon={FileQuestion}
        title="Template or variation not found"
        description="It may have been moved to the trash or deleted."
        action={
          <Button asChild variant="secondary">
            <Link href="/">Back to library</Link>
          </Button>
        }
      />
    </div>
  );
}
