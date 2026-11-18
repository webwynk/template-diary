import { Library, Plus } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { PageContainer } from "@/components/common/page-container";
import { Button } from "@/components/ui/button";

// Library. The grid, filters and search arrive in Phases 4 and 9 (DEVELOPMENT.md §7).
export default function LibraryPage() {
  return (
    <PageContainer>
      <EmptyState
        icon={Library}
        title="Your library is empty"
        description="Save your first Custom code or Elementor template and it will show up here."
        action={
          <Button asChild>
            <Link href="/templates/new">
              <Plus aria-hidden />
              Create your first template
            </Link>
          </Button>
        }
      />
    </PageContainer>
  );
}
