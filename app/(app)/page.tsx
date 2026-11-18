import { AlertCircle, Library, Plus, X } from "lucide-react";
import Link from "next/link";

import { TemplateCard } from "@/components/library/template-card";
import { TemplateTable } from "@/components/library/template-table";
import { type LibraryView, ViewToggle } from "@/components/library/view-toggle";
import { EmptyState } from "@/components/common/empty-state";
import { PageContainer } from "@/components/common/page-container";
import { TagDot } from "@/components/common/tag-dot";
import { resolveTags } from "@/components/templates/tag-pills";
import { Button } from "@/components/ui/button";
import { listTagsWithCounts } from "@/lib/db/tags";
import { listTemplates, type TemplateListItem } from "@/lib/db/templates";
import { plural } from "@/lib/format";
import { idSchema } from "@/lib/validation/templates";

// Library (DESIGN.md §7.2). Search, type/favorite filters and sorting arrive in Phase 9; the tag
// filter (?tag=) is here already because the sidebar links to it.
export default async function LibraryPage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const view: LibraryView = params.view === "list" ? "list" : "grid";
  const tagParam =
    typeof params.tag === "string" && idSchema.safeParse(params.tag).success
      ? params.tag
      : undefined;

  const tagsResult = await listTagsWithCounts();
  const tags = tagsResult.ok ? tagsResult.data : [];
  const activeTag = tagParam ? tags.find((t) => t.id === tagParam) : undefined;
  const result = await listTemplates(activeTag ? { tagId: activeTag.id } : {});

  const hrefFor = (next: { view?: LibraryView; tag?: string | null }) => {
    const q = new URLSearchParams();
    const tag = next.tag === undefined ? activeTag?.id : next.tag;
    if (tag) q.set("tag", tag);
    if ((next.view ?? view) === "list") q.set("view", "list");
    const s = q.toString();
    return s ? `/?${s}` : "/";
  };

  if (!result.ok) {
    return (
      <PageContainer>
        <p role="alert" className="flex items-center gap-2 text-destructive">
          <AlertCircle className="size-4" aria-hidden />
          Couldn&apos;t load your templates. Refresh the page to try again.
        </p>
      </PageContainer>
    );
  }

  const templates = result.data;
  const now = new Date();
  const tagsFor = (t: TemplateListItem) => resolveTags(t.tagIds, tags);

  if (templates.length === 0 && !activeTag) {
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

  return (
    <PageContainer>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{plural(templates.length, "template")}</span>
          {activeTag ? (
            <Link
              href={hrefFor({ tag: null })}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background py-0.5 pr-1.5 pl-2.5 text-xs font-medium text-foreground hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label={`Remove tag filter ${activeTag.name}`}
            >
              <TagDot color={activeTag.color} />
              {activeTag.name}
              <X className="size-3.5 text-muted-foreground" aria-hidden />
            </Link>
          ) : null}
        </div>
        <ViewToggle view={view} hrefFor={(v) => hrefFor({ view: v })} />
      </div>

      {templates.length === 0 ? (
        <EmptyState
          icon={Library}
          title="No templates match these filters"
          description={`No live templates have the tag “${activeTag?.name ?? ""}”.`}
          action={
            <Button asChild variant="secondary">
              <Link href={hrefFor({ tag: null })}>Clear filters</Link>
            </Button>
          }
        />
      ) : view === "grid" ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {templates.map((t) => (
            <TemplateCard key={t.id} template={t} tags={tagsFor(t)} now={now} />
          ))}
        </ul>
      ) : (
        <TemplateTable templates={templates} tagsFor={tagsFor} now={now} />
      )}
    </PageContainer>
  );
}
