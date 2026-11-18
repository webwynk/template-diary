import { Code2, LayoutTemplate } from "lucide-react";

import type { TemplateKind } from "@/lib/engine/types";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Feature image area (DESIGN.md §6: 16:10, cover, aligned to the top, --surface-2 while
 * loading). Without an image it shows the neutral placeholder with the type icon and initials.
 */
export function TemplateThumb({
  name,
  type,
  src,
  className,
  size = "md",
}: {
  name: string;
  type: TemplateKind;
  /** Signed URL of the feature image; null/undefined shows the placeholder. */
  src?: string | null;
  className?: string;
  size?: "sm" | "md";
}) {
  if (src) {
    return (
      <div className={cn("aspect-[16/10] w-full overflow-hidden bg-surface-2", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed Storage URLs */}
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover object-top"
        />
      </div>
    );
  }
  const Icon = type === "custom" ? Code2 : LayoutTemplate;
  return (
    <div
      className={cn(
        "flex aspect-[16/10] w-full flex-col items-center justify-center gap-1 bg-surface text-subtle-foreground",
        className,
      )}
      aria-hidden
    >
      <Icon className={size === "sm" ? "size-3.5" : "size-5"} />
      {size === "md" ? (
        <span className="text-lg font-semibold tracking-[-0.01em] text-muted-foreground">
          {initials(name)}
        </span>
      ) : null}
    </div>
  );
}
