import { FileQuestion } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { PageContainer } from "@/components/common/page-container";
import { Button } from "@/components/ui/button";

export default function TemplateNotFound() {
  return (
    <PageContainer>
      <EmptyState
        icon={FileQuestion}
        title="Template not found"
        description="It may have been moved to the trash or deleted."
        action={
          <Button asChild variant="secondary">
            <Link href="/">Back to library</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}
