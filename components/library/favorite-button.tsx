"use client";

import { Star } from "lucide-react";

import { toast } from "sonner";

import { setFavoriteAction } from "@/actions/library";
import { toggleFavorite, useTemplateOverride } from "@/lib/library/optimistic";
import { cn } from "@/lib/utils";

/**
 * Favorite star (DESIGN.md §7.2), optimistic: it flips at once (on every card, row and menu
 * showing the template) and flips back with a toast if saving fails. On cards it shows on hover (desktop), always on touch and when favorited.
 */
export function FavoriteButton({
  id,
  name,
  isFavorite,
  className,
}: {
  id: string;
  name: string;
  isFavorite: boolean;
  className?: string;
}) {
  const optimistic = useTemplateOverride(id)?.favorite ?? isFavorite;

  function toggle(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    void saveFavorite(id, !optimistic);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={optimistic}
      aria-label={optimistic ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
      title={optimistic ? "Remove from favorites" : "Add to favorites"}
      data-on={optimistic || undefined}
      className={cn(
        "relative z-10 flex size-8 items-center justify-center rounded-full bg-background/90 shadow-xs outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <Star
        className={cn(
          "size-4",
          optimistic ? "fill-[#F59E0B] text-[#F59E0B]" : "text-muted-foreground",
        )}
        aria-hidden
      />
    </button>
  );
}

/** Shared by the star and the ⋯ menu: instant everywhere, toast and flip back on failure. */
export async function saveFavorite(id: string, next: boolean) {
  let error: string | undefined;
  try {
    const ok = await toggleFavorite(id, next, async () => {
      const r = await setFavoriteAction(id, next);
      if (!r.ok) error = r.error;
      return r;
    });
    if (!ok) toast.error(error ?? "Couldn't update favorites. Please try again.");
  } catch {
    toast.error("Couldn't update favorites. Check your connection and try again.");
  }
}
