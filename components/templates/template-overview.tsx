import { ArrowLeft, PencilLine, Star } from "lucide-react";
import Link from "next/link";

import { PageContainer } from "@/components/common/page-container";
import { CopyCodeButton } from "@/components/templates/copy-code-button";
import { DownloadButton } from "@/components/templates/download-button";
import { FeatureImagePanel } from "@/components/templates/feature-image-panel";
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
  now,
}: {
  template: TemplateDetail;
  tags: TagRef[];
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

      <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,480px)_1fr]">
        <FeatureImagePanel
          templateId={template.id}
          name={template.name}
          type={template.type}
          src={template.featureImageUrl}
          source={template.featureImageSource}
        />
        <div className="min-w-0 space-y-3">
          <div className="flex items-start gap-2">
            <h1 className="min-w-0 flex-1 text-2xl font-semibold tracking-[-0.02em] break-words">
              {template.name}
            </h1>
            {template.isFavorite ? (
              <Star
                className="mt-1.5 size-5 shrink-0 fill-[#F59E0B] text-[#F59E0B]"
                aria-label="Favorite"
              />
            ) : null}
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
        <h2 id="variations-heading" className="mb-3 text-lg font-semibold">
          Variations{" "}
          <span className="font-normal text-muted-foreground">({template.variations.length})</span>
        </h2>
        <VariationList
          templateId={template.id}
          variations={template.variations}
          type={template.type}
          now={now}
        />
        <p className="mt-2 text-[13px] text-muted-foreground">
          {plural(template.variations.length, "variation")} · The Original is locked and always kept
          as saved.
        </p>
      </section>
    </PageContainer>
  );
}
