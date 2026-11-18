// Group color occurrences by base RGB (DEVELOPMENT.md §6.2), shared by both engines.
import type { ColorGroup, ColorOccurrence } from "@/lib/engine/types";

function start(o: { location: ColorOccurrence["location"] }): number {
  return o.location.kind === "range" ? o.location.start : 0;
}

/** Most-used first; occurrences in document order. */
export function groupColors(occurrences: ColorOccurrence[]): ColorGroup[] {
  const map = new Map<string, ColorGroup>();
  for (const occ of occurrences) {
    let group = map.get(occ.rgb);
    if (!group) {
      group = { rgb: occ.rgb, count: 0, formats: [], occurrences: [] };
      map.set(occ.rgb, group);
    }
    group.count++;
    group.occurrences.push(occ);
    if (!group.formats.includes(occ.format)) group.formats.push(occ.format);
  }
  for (const g of map.values()) g.occurrences.sort((a, b) => start(a) - start(b));
  return [...map.values()].sort((a, b) => b.count - a.count || a.rgb.localeCompare(b.rgb));
}
