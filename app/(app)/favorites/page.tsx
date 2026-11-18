import { Heart } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { PageContainer } from "@/components/common/page-container";

export default function FavoritesPage() {
  return (
    <PageContainer>
      <EmptyState
        icon={Heart}
        title="No favorites yet"
        description="Star a template in your library to keep it here for quick access."
      />
    </PageContainer>
  );
}
