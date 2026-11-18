import { summarizeChanges } from "@/lib/editor/session";
import type { AppliedChange } from "@/lib/engine/types";
import type { Json } from "@/types/database";

/** "2 colors and 1 image changed, code edited" from a variations.changes array. */
export function changesSummary(changes: Json): string {
  if (!Array.isArray(changes)) return "";
  const applied: AppliedChange[] = [];
  const seen = new Set<string>();
  let codeEdited = false;
  for (const c of changes) {
    if (typeof c !== "object" || c === null || Array.isArray(c)) continue;
    if (c.kind === "code") codeEdited = true;
    else if (c.kind === "color" || c.kind === "image" || c.kind === "font") {
      // Saving in place appends; count each changed value once.
      const key = `${c.kind}:${String(c.from ?? "").toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      applied.push({ kind: c.kind, from: String(c.from ?? ""), to: String(c.to ?? ""), count: 1 });
    }
  }
  return summarizeChanges(applied, codeEdited);
}
