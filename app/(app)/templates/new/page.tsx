import { FilePlus2 } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { PageContainer } from "@/components/common/page-container";
import { Button } from "@/components/ui/button";

// Placeholder: the create-template flow is built in Phase 4.
export default function NewTemplatePage() {
  return (
    <PageContainer>
      <EmptyState
        icon={FilePlus2}
        title="Coming soon"
        description="Creating Custom and Elementor templates is the next big step in the plan."
        action={
          <Button asChild variant="secondary">
            <Link href="/">Back to library</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}
