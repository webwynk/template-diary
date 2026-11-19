import { ArrowLeft, PencilLine } from "lucide-react";
import Link from "next/link";

import { PageContainer } from "@/components/common/page-container";
import { FavoriteButton } from "@/components/library/favorite-button";
import { TemplateMenu } from "@/components/library/template-menu";
import { CompareButton } from "@/components/templates/compare-button";
import { CopyCodeButton } from "@/components/templates/copy-code-button";
import { DownloadButton } from "@/components/templates/download-button";
import { FeatureImagePanel } from "@/components/templates/feature-image-panel";
import { TrashedVariations } from "@/components/templates/trashed-variations";
import { TagPills, type TagRef } from "@/components/templates/tag-pills";
import { TypeBadge } from "@/components/templates/type-badge";
import { VariationList } from "@/components/templates/variation-list";
import { Button } from "@/components/ui/button";
import type { TemplateDetail } from "@/lib/db/templates";
import { plural } from "@/lib/format";

/** Template overview (DESIGN.md §7.4): image, details, Copy/Download of the Original, variations. */
export function TemplateOverview({
  template,
  tags,
  allTags,
  now,
}: {
  template: TemplateDetail;
  tags: TagRef[];
  /** Every tag, for "Edit details". */
  allTags: TagRef[];
  now: Date;
}) {
  const original = template.variations.find((v) => v.isOriginal);
  return (
    <PageContainer>
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Library
      </Link>

      {/* Side by side from 1024px only: next to the sidebar a fixed 480px image left the details
          too narrow for their buttons at tablet widths. The image is capped at 480px (§7.4). */}
      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="w-full max-w-[480px] min-w-0">
          <FeatureImagePanel
            templateId={template.id}
            name={template.name}
            type={template.type}
            src={template.featureImageUrl}
            source={template.featureImageSource}
          />
        </div>
        <div className="min-w-0 space-y-3">
          <div className="flex items-start gap-2">
            <h1 className="min-w-0 flex-1 text-2xl font-semibold tracking-[-0.02em] break-words">
              {template.name}
            </h1>
            <FavoriteButton
              id={template.id}
              name={template.name}
              isFavorite={template.isFavorite}
              className="mt-0.5 shrink-0 bg-transparent shadow-none hover:bg-surface-2"
            />
            <TemplateMenu
              template={template}
              isFavorite={template.isFavorite}
              tags={allTags}
              showOpen={false}
              afterTrash="/"
              className="mt-0.5 size-8"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <TypeBadge type={template.type} />
            <TagPills tags={tags} />
          </div>
          {template.usedIn ? (
            <p className="text-sm break-words">
              <span className="text-muted-foreground">Used in: </span>
              {template.usedIn}
            </p>
          ) : null}
          {template.notes ? (
            <p className="text-sm break-words whitespace-pre-line text-muted-foreground">
              {template.notes}
            </p>
          ) : null}
          {original ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild size="md">
                <Link href={`/templates/${template.id}/edit`}>
                  <PencilLine aria-hidden />
                  Open editor
                </Link>
              </Button>
              {template.type === "custom" ? (
                <CopyCodeButton variationId={original.id} label="Copy original code" size="md" />
              ) : (
                <DownloadButton
                  variationId={original.id}
                  label="Download original .json"
                  size="md"
                />
              )}
            </div>
          ) : null}
        </div>
      </div>

      <section aria-labelledby="variations-heading" className="mt-10">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="variations-heading" className="text-lg font-semibold">
            Variations{" "}
            <span className="font-normal text-muted-foreground">
              ({template.variations.length})
            </span>
          </h2>
          <CompareButton
            type={template.type}
            options={template.variations.map((v) => ({ id: v.id, name: v.name }))}
          />
        </div>
        <VariationList
          templateId={template.id}
          templateName={template.name}
          variations={template.variations}
          trashed={template.trashedVariations}
          type={template.type}
          now={now}
        />
        <p className="mt-2 text-[13px] text-muted-foreground">
          {plural(template.variations.length, "variation")} · The Original is locked and always kept
          as saved.
        </p>
      </section>

      {template.trashedVariations.length > 0 ? (
        <section aria-labelledby="trashed-variations-heading" className="mt-8">
          <h2 id="trashed-variations-heading" className="mb-3 text-base font-semibold">
            Trashed variations{" "}
            <span className="font-normal text-muted-foreground">
              ({template.trashedVariations.length})
            </span>
          </h2>
          <TrashedVariations items={template.trashedVariations} now={now} />
        </section>
      ) : null}
    </PageContainer>
  );
}
