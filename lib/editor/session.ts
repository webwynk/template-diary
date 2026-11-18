// Editor state (DEVELOPMENT.md Phase 5). Pure functions so they can be unit tested; the React
// hook in components/editor/use-editor-session.ts wires them up.
//
// Model: `source` is the code being edited (the base variation plus any manual edits). Palette
// changes are kept as *pending swaps* on top of it, so each row can be reset at any time. The
// content that is previewed and saved is always applySwaps(source, swaps) from lib/engine.
import {
  applySwaps,
  type AppliedChange,
  type Detection,
  EngineError,
  type Swap,
} from "@/lib/engine";
import type { TemplateKind } from "@/lib/engine/types";

export type SwapKind = Swap["kind"];

export interface PendingEntry {
  /** Display value of what is replaced: "#4f46e5", a URL, or a font family as detected. */
  from: string;
  to: string;
  /** Occurrence ids that stay unchanged. Ids are offsets, so they are cleared on manual edits. */
  excludeIds: string[];
}

export interface EditorState {
  base: string;
  source: string;
  /** Keyed by kind, then by normalized `from` (lowercase color / exact URL / lowercase family). */
  pending: Record<SwapKind, Record<string, PendingEntry>>;
}

export type EditorAction =
  | { type: "setSource"; source: string }
  | { type: "setTarget"; kind: SwapKind; from: string; to: string }
  | { type: "resetRow"; kind: SwapKind; from: string }
  | { type: "toggleExclude"; kind: SwapKind; from: string; id: string }
  | { type: "resetAll" };

export function pendingKey(kind: SwapKind, from: string): string {
  return kind === "image" ? from : from.trim().toLowerCase();
}

export function initialState(base: string): EditorState {
  return { base, source: base, pending: { color: {}, image: {}, font: {} } };
}

function clearExcludes(pending: EditorState["pending"]): EditorState["pending"] {
  const out = { color: {}, image: {}, font: {} } as EditorState["pending"];
  for (const kind of ["color", "image", "font"] as const) {
    for (const [key, entry] of Object.entries(pending[kind])) {
      out[kind][key] = { ...entry, excludeIds: [] };
    }
  }
  return out;
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "setSource":
      if (action.source === state.source) return state;
      return { ...state, source: action.source, pending: clearExcludes(state.pending) };
    case "setTarget": {
      const key = pendingKey(action.kind, action.from);
      const existing = state.pending[action.kind][key];
      return {
        ...state,
        pending: {
          ...state.pending,
          [action.kind]: {
            ...state.pending[action.kind],
            [key]: { from: action.from, to: action.to, excludeIds: existing?.excludeIds ?? [] },
          },
        },
      };
    }
    case "resetRow": {
      const key = pendingKey(action.kind, action.from);
      if (!(key in state.pending[action.kind])) return state;
      const rest = { ...state.pending[action.kind] };
      delete rest[key];
      return { ...state, pending: { ...state.pending, [action.kind]: rest } };
    }
    case "toggleExclude": {
      const key = pendingKey(action.kind, action.from);
      const entry = state.pending[action.kind][key];
      if (!entry) return state;
      const excluded = entry.excludeIds.includes(action.id)
        ? entry.excludeIds.filter((id) => id !== action.id)
        : [...entry.excludeIds, action.id];
      return {
        ...state,
        pending: {
          ...state.pending,
          [action.kind]: {
            ...state.pending[action.kind],
            [key]: { ...entry, excludeIds: excluded },
          },
        },
      };
    }
    case "resetAll":
      return { ...state, source: state.base, pending: { color: {}, image: {}, font: {} } };
  }
}

/**
 * Swaps for the engine: only rows whose `from` is still detected in the current source
 * ("pending swaps that still match"), with exclusions limited to ids that still exist.
 */
export function activeSwaps(pending: EditorState["pending"], detection: Detection): Swap[] {
  const swaps: Swap[] = [];
  for (const group of detection.colors) {
    const entry = pending.color[group.rgb];
    if (!entry) continue;
    const ids = new Set(group.occurrences.map((o) => o.id));
    swaps.push({
      kind: "color",
      fromRgb: group.rgb,
      to: entry.to,
      excludeIds: entry.excludeIds.filter((id) => ids.has(id)),
    });
  }
  const imageIds = new Map<string, Set<string>>();
  for (const img of detection.images) {
    const set = imageIds.get(img.url) ?? new Set<string>();
    set.add(img.id);
    imageIds.set(img.url, set);
  }
  for (const [url, ids] of imageIds) {
    const entry = pending.image[url];
    if (entry)
      swaps.push({
        kind: "image",
        fromUrl: url,
        to: entry.to,
        excludeIds: entry.excludeIds.filter((id) => ids.has(id)),
      });
  }
  const fontIds = new Map<string, { family: string; ids: Set<string> }>();
  for (const f of detection.fonts) {
    const key = f.family.toLowerCase();
    const item = fontIds.get(key) ?? { family: f.family, ids: new Set<string>() };
    item.ids.add(f.id);
    fontIds.set(key, item);
  }
  for (const [key, { family, ids }] of fontIds) {
    const entry = pending.font[key];
    if (entry)
      swaps.push({
        kind: "font",
        fromFamily: family,
        to: entry.to,
        excludeIds: entry.excludeIds.filter((id) => ids.has(id)),
      });
  }
  return swaps;
}

export type OutputResult =
  { ok: true; content: string; applied: AppliedChange[] } | { ok: false; error: string };

export function computeOutput(source: string, type: TemplateKind, swaps: Swap[]): OutputResult {
  try {
    const result = applySwaps(source, type, swaps);
    return { ok: true, content: result.content, applied: result.applied };
  } catch (error) {
    if (error instanceof EngineError) return { ok: false, error: error.message };
    throw error;
  }
}

/** "2 colors, 1 image and 1 font changed", plus code edits. Empty string when nothing changed. */
export function summarizeChanges(applied: AppliedChange[], codeEdited: boolean): string {
  const count = (kind: SwapKind) => applied.filter((a) => a.kind === kind).length;
  const parts: string[] = [];
  const add = (n: number, word: string) => {
    if (n > 0) parts.push(`${n} ${word}${n === 1 ? "" : "s"}`);
  };
  add(count("color"), "color");
  add(count("image"), "image");
  add(count("font"), "font");
  let text =
    parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : (parts[0] ?? "");
  if (text) text += " changed";
  if (codeEdited) text = text ? `${text}, code edited` : "Code edited";
  return text;
}

/** A highlighted range in the source with optional inline text (structurally a CodeDecoration). */
export interface ChangeMark {
  start: number;
  end: number;
  after?: string;
}

function shortUrl(url: string): string {
  if (url.startsWith("data:")) return "data URI";
  const name = url.split(/[?#]/)[0]!.split("/").filter(Boolean).at(-1) ?? url;
  return name.length > 32 ? `${name.slice(0, 31)}…` : name;
}

/**
 * Where active swaps change the source (Custom only: Elementor locations are JSON paths).
 * Offsets refer to the source the detection was made from.
 */
export function changeMarks(detection: Detection, swaps: Swap[]): ChangeMark[] {
  const marks: ChangeMark[] = [];
  const push = (location: Detection["images"][number]["location"], after: string) => {
    if (location.kind === "range") marks.push({ start: location.start, end: location.end, after });
  };
  for (const swap of swaps) {
    const excluded = new Set(swap.excludeIds ?? []);
    if (swap.kind === "color") {
      const group = detection.colors.find((g) => g.rgb === swap.fromRgb);
      for (const o of group?.occurrences ?? []) {
        if (!excluded.has(o.id)) push(o.location, `→ ${swap.to}`);
      }
    } else if (swap.kind === "image") {
      for (const o of detection.images) {
        if (o.url === swap.fromUrl && !excluded.has(o.id))
          push(o.location, `→ ${shortUrl(swap.to)}`);
      }
    } else {
      const family = swap.fromFamily.toLowerCase();
      for (const o of detection.fonts) {
        if (o.family.toLowerCase() === family && !excluded.has(o.id))
          push(o.location, `→ ${swap.to}`);
      }
    }
  }
  return marks.sort((a, b) => a.start - b.start);
}

/** "#abc" / "#abcd" / "#aabbcc" / "#aabbccdd" → lowercase 6 or 8 digit hex; null otherwise. */
export function normalizeHex(input: string): string | null {
  const m = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(input.trim());
  if (!m) return null;
  const digits = m[1]!.toLowerCase();
  const full = digits.length <= 4 ? [...digits].map((c) => c + c).join("") : digits;
  // A fully opaque alpha says nothing; drop it so each place keeps its own transparency.
  return `#${full.length === 8 && full.endsWith("ff") ? full.slice(0, 6) : full}`;
}
