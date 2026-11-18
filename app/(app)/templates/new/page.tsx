import { PageContainer } from "@/components/common/page-container";
import { NewTemplateForm } from "@/components/templates/new/new-template-form";
import { listTagsWithCounts } from "@/lib/db/tags";

export default async function NewTemplatePage() {
  const tags = await listTagsWithCounts();
  return (
    <PageContainer>
      <NewTemplateForm
        tags={tags.ok ? tags.data.map(({ id, name, color }) => ({ id, name, color })) : []}
      />
    </PageContainer>
  );
}
