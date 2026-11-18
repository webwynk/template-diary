export type DbResult<T> = { ok: true; data: T } | { ok: false; error: string };

type PostgrestLikeError = { code?: string; message: string };

/** Turn a Supabase/Postgres error into a sentence for the UI; log the technical detail. */
export function toUserError(
  error: PostgrestLikeError,
  context: string,
  messages: Partial<Record<string, string>> = {},
): string {
  const mapped = error.code ? messages[error.code] : undefined;
  if (mapped) return mapped;
  console.error(`[db] ${context}`, error.code, error.message);
  return "Something went wrong. Please try again.";
}
