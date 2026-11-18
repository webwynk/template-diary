import { TagDot } from "@/components/common/tag-dot";
import { cn } from "@/lib/utils";

export interface TagRef {
  id: string;
  name: string;
  color: string;
}

/** Tag pills (dot + name on a neutral background). Shows `max` pills, then "+N". */
export function TagPills({
  tags,
  max,
  className,
}: {
  tags: TagRef[];
  max?: number;
  className?: string;
}) {
  if (tags.length === 0) return null;
  const shown = max === undefined ? tags : tags.slice(0, max);
  const hidden = tags.length - shown.length;
  return (
    <ul className={cn("flex min-w-0 flex-wrap items-center gap-1", className)} aria-label="Tags">
      {shown.map((tag) => (
        <li
          key={tag.id}
          className="inline-flex max-w-40 items-center gap-1.5 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-foreground"
        >
          <TagDot color={tag.color} />
          <span className="truncate">{tag.name}</span>
        </li>
      ))}
      {hidden > 0 ? (
        <li
          className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted-foreground"
          title={tags
            .slice(shown.length)
            .map((t) => t.name)
            .join(", ")}
        >
          +{hidden}
        </li>
      ) : null}
    </ul>
  );
}

/** Resolve tag ids against the user's tags, keeping the tag list's (alphabetical) order. */
export function resolveTags(ids: string[], all: TagRef[]): TagRef[] {
  const set = new Set(ids);
  return all.filter((t) => set.has(t.id));
}
