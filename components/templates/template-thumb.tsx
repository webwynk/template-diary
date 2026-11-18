import { Code2, LayoutTemplate } from "lucide-react";

import type { TemplateKind } from "@/lib/engine/types";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Feature image area (16:10). Real images arrive in Phase 6; until then (and whenever a
 * template has no image) this neutral placeholder shows the type icon and initials.
 */
export function TemplateThumb({
  name,
  type,
  className,
  size = "md",
}: {
  name: string;
  type: TemplateKind;
  className?: string;
  size?: "sm" | "md";
}) {
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
