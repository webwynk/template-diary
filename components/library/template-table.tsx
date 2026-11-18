import Link from "next/link";

import { TagPills, type TagRef } from "@/components/templates/tag-pills";
import { TemplateThumb } from "@/components/templates/template-thumb";
import { TypeBadge } from "@/components/templates/type-badge";
import type { TemplateListItem } from "@/lib/db/templates";
import { relativeTime } from "@/lib/format";

/** DESIGN.md §7.2 List view: image, name, type, tags, variations, updated. */
export function TemplateTable({
  templates,
  tagsFor,
  now,
}: {
  templates: TemplateListItem[];
  tagsFor: (t: TemplateListItem) => TagRef[];
  now: Date;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="sticky top-0 bg-surface text-xs font-medium tracking-[0.04em] text-muted-foreground uppercase">
          <tr className="border-b border-border">
            <th scope="col" className="w-[88px] px-4 py-2.5">
              <span className="sr-only">Image</span>
            </th>
            <th scope="col" className="px-2 py-2.5">
              Name
            </th>
            <th scope="col" className="px-2 py-2.5">
              Type
            </th>
            <th scope="col" className="px-2 py-2.5">
              Tags
            </th>
            <th scope="col" className="px-2 py-2.5 text-right">
              Variations
            </th>
            <th scope="col" className="px-4 py-2.5 text-right">
              Updated
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {templates.map((t) => (
            <tr key={t.id} className="relative hover:bg-surface-2/60">
              <td className="px-4 py-2">
                <TemplateThumb
                  name={t.name}
                  type={t.type}
                  src={t.featureImageUrl}
                  size="sm"
                  className="w-16 rounded-md border border-border"
                />
              </td>
              <td className="max-w-[280px] px-2 py-2 font-medium">
                <Link
                  href={`/templates/${t.id}`}
                  className="block truncate outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
                >
                  {t.name}
                </Link>
              </td>
              <td className="px-2 py-2">
                <TypeBadge type={t.type} />
              </td>
              <td className="px-2 py-2">
                <TagPills tags={tagsFor(t)} max={3} />
              </td>
              <td className="px-2 py-2 text-right tabular-nums">{t.variationCount}</td>
              <td className="px-4 py-2 text-right whitespace-nowrap text-muted-foreground">
                {relativeTime(t.updatedAt, now)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
