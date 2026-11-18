import { Palette } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { PageContainer } from "@/components/common/page-container";

export default function PalettesPage() {
  return (
    <PageContainer>
      <EmptyState
        icon={Palette}
        title="No palettes yet"
        description="Save a set of colors from the editor and reuse it on any template."
      />
    </PageContainer>
  );
}
