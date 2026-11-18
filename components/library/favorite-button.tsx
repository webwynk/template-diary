"use client";

import { Star } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { setFavoriteAction } from "@/actions/library";
import { cn } from "@/lib/utils";

/**
 * Favorite star (DESIGN.md §7.2), optimistic: it flips at once and flips back with a toast if
 * saving fails. On cards it shows on hover (desktop), always on touch and when favorited.
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
  const [optimistic, setOptimistic] = useOptimistic(isFavorite);
  const [, startTransition] = useTransition();

  function toggle(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const next = !optimistic;
    startTransition(async () => {
      setOptimistic(next);
      try {
        const result = await setFavoriteAction(id, next);
        if (!result.ok) toast.error(result.error);
      } catch {
        toast.error("Couldn't update favorites. Check your connection and try again.");
      }
    });
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
