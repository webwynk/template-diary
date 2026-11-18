// Swap validation shared by both engines. The shapes live in lib/validation/swaps.ts (Zod).
import { EngineError, type Swap } from "@/lib/engine/types";
import { imageUrlSchema, swapListSchema } from "@/lib/validation/swaps";

/** Throws an EngineError with a user-facing message if any swap is invalid or repeated. */
export function checkSwaps(swaps: Swap[]): void {
  const result = swapListSchema.safeParse(swaps);
  if (!result.success) {
    throw new EngineError(result.error.issues[0]?.message ?? "Invalid swap.");
  }
}

export function normalizedImageUrl(url: string): string {
  const result = imageUrlSchema.safeParse(url);
  if (!result.success)
    throw new EngineError(result.error.issues[0]?.message ?? "Invalid image link.");
  return result.data;
}
