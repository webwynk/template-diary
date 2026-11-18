import { AlertCircle } from "lucide-react";

import { PageContainer } from "@/components/common/page-container";
import { TrashList } from "@/components/trash/trash-list";
import { listTrash } from "@/lib/db/library";

// Trash (DESIGN.md §7.7). Items are purged daily after trash_retention_days (default 30).
export default async function TrashPage() {
  const result = await listTrash();
  return (
    <PageContainer>
      {result.ok ? (
        <TrashList
          entries={result.data.entries}
          retentionDays={result.data.retentionDays}
          now={new Date()}
        />
      ) : (
        <p role="alert" className="flex items-center gap-2 text-destructive">
          <AlertCircle className="size-4" aria-hidden />
          Couldn&apos;t load the trash. Refresh the page to try again.
        </p>
      )}
    </PageContainer>
  );
}
