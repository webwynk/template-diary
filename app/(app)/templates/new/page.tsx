import { PageContainer } from "@/components/common/page-container";
import { NewTemplateForm } from "@/components/templates/new/new-template-form";
import { getPreferences } from "@/lib/db/settings";
import { listTagsWithCounts } from "@/lib/db/tags";

export default async function NewTemplatePage() {
  const [tags, prefs] = await Promise.all([listTagsWithCounts(), getPreferences()]);
  return (
    <PageContainer>
      <NewTemplateForm
        tags={tags.ok ? tags.data.map(({ id, name, color }) => ({ id, name, color })) : []}
        defaultImageMode={prefs.ok ? prefs.data.defaultFeatureMode : "auto"}
      />
    </PageContainer>
  );
}
