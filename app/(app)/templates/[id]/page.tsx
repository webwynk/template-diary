import { AlertCircle } from "lucide-react";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/common/page-container";
import { resolveTags } from "@/components/templates/tag-pills";
import { TemplateOverview } from "@/components/templates/template-overview";
import { listTagsWithCounts } from "@/lib/db/tags";
import { getTemplate } from "@/lib/db/templates";
import { idSchema } from "@/lib/validation/templates";

// Template overview (DESIGN.md §7.4).
export default async function TemplatePage({ params }: PageProps<"/templates/[id]">) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();

  const [result, tagsResult] = await Promise.all([getTemplate(id), listTagsWithCounts()]);
  if (!result.ok) {
    return (
      <PageContainer>
        <p role="alert" className="flex items-center gap-2 text-destructive">
          <AlertCircle className="size-4" aria-hidden />
          Couldn&apos;t load this template. Refresh the page to try again.
        </p>
      </PageContainer>
    );
  }
  if (!result.data) notFound();

  const tags = resolveTags(result.data.tagIds, tagsResult.ok ? tagsResult.data : []);
  return <TemplateOverview template={result.data} tags={tags} now={new Date()} />;
}
