import { AlertCircle, Library, Plus, Star, X } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { PageContainer } from "@/components/common/page-container";
import { TagDot } from "@/components/common/tag-dot";
import { LibraryToolbar } from "@/components/library/library-toolbar";
import { TemplateCard } from "@/components/library/template-card";
import { TemplateTable } from "@/components/library/template-table";
import { ViewToggle } from "@/components/library/view-toggle";
import { resolveTags } from "@/components/templates/tag-pills";
import { Button } from "@/components/ui/button";
import { listTagsWithCounts } from "@/lib/db/tags";
import { listTemplates, type TemplateListItem } from "@/lib/db/templates";
import { plural } from "@/lib/format";
import { filtersHref, hasActiveFilters, type LibraryFilters } from "@/lib/library/filters";

const TYPE_LABELS = { custom: "Custom", elementor: "Elementor" } as const;

/**
 * Library (DESIGN.md §7.2) and Favorites (the same view with the favorites filter fixed on).
 * Search, type, tag, favorites and sort all come from the URL and combine.
 */
export async function LibraryBrowser({
  filters: requested,
  base,
}: {
  filters: LibraryFilters;
  base: "/" | "/favorites";
}) {
  const filters: LibraryFilters = base === "/favorites" ? { ...requested, fav: true } : requested;
  // Tags (shared with the sidebar) and templates load at the same time.
  const [tagsResult, first] = await Promise.all([listTagsWithCounts(), listTemplates(filters)]);
  const tags = tagsResult.ok ? tagsResult.data : [];
  const activeTag = filters.tag ? tags.find((t) => t.id === filters.tag) : undefined;
  // A tag that no longer exists is ignored instead of showing nothing (rare: one more query).
  const effective = {
    ...filters,
    tag: activeTag ? activeTag.id : tagsResult.ok ? null : filters.tag,
  };
  const result =
    filters.tag && !activeTag && tagsResult.ok ? await listTemplates(effective) : first;

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
  const href = (patch: Partial<LibraryFilters>) => filtersHref(effective, patch, base);
  const filtered = hasActiveFilters({ ...effective, fav: base === "/" && effective.fav });

  if (templates.length === 0 && !filtered) {
    return (
      <PageContainer>
        {base === "/favorites" ? (
          <EmptyState
            icon={Star}
            title="No favorites yet"
            description="Star a template in your library to keep it here for quick access."
            action={
              <Button asChild variant="secondary">
                <Link href="/">Go to library</Link>
              </Button>
            }
          />
        ) : (
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
        )}
      </PageContainer>
    );
  }

  const chips: { label: React.ReactNode; text: string; href: string }[] = [];
  if (effective.q)
    chips.push({ label: `“${effective.q}”`, text: `search ${effective.q}`, href: href({ q: "" }) });
  if (effective.type)
    chips.push({
      label: TYPE_LABELS[effective.type],
      text: `type ${TYPE_LABELS[effective.type]}`,
      href: href({ type: null }),
    });
  if (activeTag)
    chips.push({
      label: (
        <>
          <TagDot color={activeTag.color} />
          {activeTag.name}
        </>
      ),
      text: `tag ${activeTag.name}`,
      href: href({ tag: null }),
    });
  if (base === "/" && effective.fav)
    chips.push({ label: "Favorites", text: "favorites", href: href({ fav: false }) });

  return (
    <PageContainer>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <LibraryToolbar filters={effective} tags={tags} base={base} />
        </div>
        <ViewToggle view={effective.view} hrefFor={(v) => href({ view: v })} />
      </div>

      <div className="mb-4 flex min-h-7 flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span aria-live="polite">{plural(templates.length, "template")}</span>
        {chips.map((c) => (
          <Link
            key={c.text}
            href={c.href}
            replace
            scroll={false}
            aria-label={`Remove filter ${c.text}`}
            className="inline-flex max-w-[240px] items-center gap-1.5 rounded-full border border-border bg-background py-0.5 pr-1.5 pl-2.5 text-xs font-medium text-foreground hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span className="flex min-w-0 items-center gap-1.5 truncate">{c.label}</span>
            <X className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        ))}
        {chips.length > 1 ? (
          <Link
            href={filtersHref(effective, { q: "", type: null, tag: null, fav: false }, base)}
            replace
            scroll={false}
            className="text-xs font-medium text-primary hover:underline"
          >
            Clear all
          </Link>
        ) : null}
      </div>

      {templates.length === 0 ? (
        <EmptyState
          icon={Library}
          title="No templates match these filters"
          description="Try another search, or remove a filter."
          action={
            <Button asChild variant="secondary">
              <Link
                href={filtersHref(effective, { q: "", type: null, tag: null, fav: false }, base)}
              >
                Clear filters
              </Link>
            </Button>
          }
        />
      ) : effective.view === "grid" ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {templates.map((t) => (
            <TemplateCard key={t.id} template={t} tags={tagsFor(t)} allTags={tags} now={now} />
          ))}
        </ul>
      ) : (
        <TemplateTable templates={templates} tagsFor={tagsFor} allTags={tags} now={now} />
      )}
    </PageContainer>
  );
}
