import Link from "next/link";

import { FavoriteButton } from "@/components/library/favorite-button";
import { TemplateMenu } from "@/components/library/template-menu";
import { TagPills, type TagRef } from "@/components/templates/tag-pills";
import { TemplateThumb } from "@/components/templates/template-thumb";
import { TypeBadge } from "@/components/templates/type-badge";
import type { TemplateListItem } from "@/lib/db/templates";
import { plural, relativeTime } from "@/lib/format";

/** DESIGN.md §7.2 Template card. The whole card links to the template page. */
export function TemplateCard({
  template,
  tags,
  allTags,
  now,
}: {
  template: TemplateListItem;
  tags: TagRef[];
  /** Every tag, for "Edit details". */
  allTags: TagRef[];
  now: Date;
}) {
  return (
    <li className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-background transition-[box-shadow,border-color] focus-within:border-border-strong hover:border-border-strong hover:shadow-sm">
      <TemplateThumb
        name={template.name}
        type={template.type}
        src={template.featureImageUrl}
        className="border-b border-border"
      />
      <FavoriteButton
        id={template.id}
        name={template.name}
        isFavorite={template.isFavorite}
        className="absolute top-2 right-2 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 data-on:opacity-100 [@media(hover:none)]:opacity-100"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
        <div className="flex items-start gap-1">
          <h3 className="min-w-0 flex-1 truncate text-base font-semibold">
            <Link
              href={`/templates/${template.id}`}
              className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-offset-2"
            >
              {template.name}
            </Link>
          </h3>
          <TemplateMenu
            template={template}
            isFavorite={template.isFavorite}
            tags={allTags}
            className="-my-1 -mr-1"
          />
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <TypeBadge type={template.type} />
          <TagPills tags={tags} max={2} />
        </div>
        <p className="text-[13px] text-muted-foreground">
          {plural(template.variationCount, "variation")} · edited{" "}
          {relativeTime(template.updatedAt, now)}
        </p>
      </div>
    </li>
  );
}
