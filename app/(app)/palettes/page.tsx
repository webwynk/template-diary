import { AlertCircle } from "lucide-react";

import { PageContainer } from "@/components/common/page-container";
import { PalettesManager } from "@/components/palettes/palettes-manager";
import { listPresets } from "@/lib/db/presets";

// Palettes (DESIGN.md §7.6, DEVELOPMENT.md Phase 8).
export default async function PalettesPage() {
  const result = await listPresets();
  return (
    <PageContainer>
      {result.ok ? (
        <PalettesManager presets={result.data} />
      ) : (
        <p role="alert" className="flex items-center gap-2 text-destructive">
          <AlertCircle className="size-4" aria-hidden />
          Couldn&apos;t load your palettes. Refresh the page to try again.
        </p>
      )}
    </PageContainer>
  );
}
