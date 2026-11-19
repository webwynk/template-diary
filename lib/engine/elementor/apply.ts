// Apply swaps to an Elementor export. DEVELOPMENT.md §6.3.
//
// Values are replaced in the original JSON text at their exact token ranges, so nothing else in
// the file changes (no key reordering, no re-indenting, "\/" escapes kept). Each token is checked
// to still hold the detected value before it is replaced.
import { replacementFor } from "@/lib/engine/colors";
import { applyEdits, type Edit } from "@/lib/engine/custom/apply";
import { detectElementor, parseElementor } from "@/lib/engine/elementor/detect";
import {
  encodeJsonString,
  type JsonPath,
  locateTokens,
  pathKey,
  type TokenMap,
} from "@/lib/engine/elementor/json-locate";
import {
  type AppliedChange,
  type ApplyResult,
  EngineError,
  type Location,
  type PaletteSwap,
} from "@/lib/engine/types";
import { checkSwaps, normalizedImageUrl } from "@/lib/engine/validate";

export function applyElementor(json: string, swaps: PaletteSwap[]): ApplyResult {
  checkSwaps(swaps);
  const data = parseElementor(json);
  const detection = detectElementor(json, data);
  const tokens = locateTokens(json);
  const edits: Edit[] = [];
  const applied: AppliedChange[] = [];

  for (const swap of swaps) {
    const excluded = new Set(swap.excludeIds ?? []);
    let count = 0;

    if (swap.kind === "color") {
      const group = detection.colors.find((g) => g.rgb === swap.fromRgb.toLowerCase());
      for (const occ of group?.occurrences ?? []) {
        if (excluded.has(occ.id)) continue;
        const next = replacementFor(occ, swap.to);
        if (next === occ.raw) continue;
        edits.push(stringEdit(json, tokens, pathOf(occ.location), occ.raw, next));
        count++;
      }
    } else if (swap.kind === "image") {
      const to = normalizedImageUrl(swap.to);
      for (const occ of detection.images) {
        if (occ.url !== swap.fromUrl || excluded.has(occ.id) || occ.url === to) continue;
        const path = pathOf(occ.location);
        edits.push(stringEdit(json, tokens, [...path, "url"], occ.url, to));
        // The media id belongs to the site the export came from; clear it so Elementor uses the URL.
        const idToken = token(tokens, [...path, "id"]);
        const idRaw = json.slice(idToken.start, idToken.end);
        if (idRaw !== '""') edits.push({ ...idToken, raw: idRaw, text: '""' });
        count++;
      }
    } else {
      const from = swap.fromFamily.trim().toLowerCase();
      const to = swap.to.trim();
      for (const occ of detection.fonts) {
        if (occ.family.toLowerCase() !== from || excluded.has(occ.id) || occ.raw === to) continue;
        edits.push(stringEdit(json, tokens, pathOf(occ.location), occ.raw, to));
        count++;
      }
    }

    if (count > 0) {
      const from =
        swap.kind === "color"
          ? swap.fromRgb.toLowerCase()
          : swap.kind === "image"
            ? swap.fromUrl
            : swap.fromFamily.trim();
      applied.push({ kind: swap.kind, from, to: swap.to.trim(), count });
    }
  }

  const content = applyEdits(json, edits);
  // Belt and braces: the result must still be valid JSON of the same shape.
  parseElementor(content);
  return { content, applied };
}

function pathOf(location: Location): JsonPath {
  if (location.kind !== "path")
    throw new EngineError("Unexpected location in an Elementor export.");
  return location.path;
}

function token(tokens: TokenMap, path: JsonPath) {
  const t = tokens.get(pathKey(path));
  if (!t) throw new EngineError("A value in the export couldn't be located. Nothing was changed.");
  return t;
}

function stringEdit(
  json: string,
  tokens: TokenMap,
  path: JsonPath,
  expected: string,
  next: string,
): Edit {
  const t = token(tokens, path);
  const raw = json.slice(t.start, t.end);
  if (JSON.parse(raw) !== expected) {
    throw new EngineError("The export changed while applying swaps. Nothing was changed.");
  }
  return { start: t.start, end: t.end, raw, text: encodeJsonString(next, raw) };
}
