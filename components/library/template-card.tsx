import { Star } from "lucide-react";
import Link from "next/link";

import { TagPills, type TagRef } from "@/components/templates/tag-pills";
import { TemplateThumb } from "@/components/templates/template-thumb";
import { TypeBadge } from "@/components/templates/type-badge";
import type { TemplateListItem } from "@/lib/db/templates";
import { plural, relativeTime } from "@/lib/format";

/** DESIGN.md §7.2 Template card. The whole card links to the template page. */
export function TemplateCard({
  template,
  tags,
  now,
}: {
  template: TemplateListItem;
  tags: TagRef[];
  now: Date;
}) {
  return (
    <li className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-background transition-[box-shadow,border-color] focus-within:border-border-strong hover:border-border-strong hover:shadow-sm">
      <TemplateThumb name={template.name} type={template.type} className="border-b border-border" />
      {template.isFavorite ? (
        <span
          className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-background/90 shadow-xs"
          title="Favorite"
        >
          <Star className="size-4 fill-[#F59E0B] text-[#F59E0B]" aria-hidden />
          <span className="sr-only">Favorite</span>
        </span>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
        <h3 className="truncate text-base font-semibold">
          <Link
            href={`/templates/${template.id}`}
            className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-offset-2"
          >
            {template.name}
          </Link>
        </h3>
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
