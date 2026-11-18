import { cn } from "@/lib/utils";

/** The small colored dot shown before a tag name (DESIGN.md §8, Tag pill). */
export function TagDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color }}
    />
  );
}
