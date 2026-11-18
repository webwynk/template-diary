import { Trash2 } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { PageContainer } from "@/components/common/page-container";

export default function TrashPage() {
  return (
    <PageContainer>
      <EmptyState
        icon={Trash2}
        title="Trash is empty"
        description="Deleted templates and variations stay here for 30 days, and you can restore them."
      />
    </PageContainer>
  );
}
