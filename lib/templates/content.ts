// Rules for template content that both the browser and the server check (DEVELOPMENT.md §5.2).
// Imports stay on the small Elementor parser so the browser bundle doesn't pull in the HTML/CSS engine.
import { parseElementor } from "@/lib/engine/elementor/detect";
import { EngineError, MAX_CONTENT_BYTES, type TemplateKind } from "@/lib/engine/types";

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface ElementorInfo {
  kind: string; // "section", "page", … from the export's "type", or "template"
  widgets: number;
}

/** Count widgets in an Elementor export (any depth). */
function countWidgets(nodes: unknown[]): number {
  let n = 0;
  for (const node of nodes) {
    if (typeof node !== "object" || node === null) continue;
    const el = node as { elType?: unknown; elements?: unknown };
    if (el.elType === "widget") n++;
    if (Array.isArray(el.elements)) n += countWidgets(el.elements);
  }
  return n;
}

/**
 * Check content before it is saved. Returns an error sentence or, for Elementor, a short
 * description of the export. Content is never modified here.
 */
export function checkContent(
  content: string,
  type: TemplateKind,
): { ok: true; elementor: ElementorInfo | null } | { ok: false; error: string } {
  if (content.trim() === "") {
    return {
      ok: false,
      error: type === "custom" ? "Paste your template code." : "Upload an Elementor .json export.",
    };
  }
  // Postgres text can't store NUL characters; they never appear in real HTML or JSON.
  if (content.includes("\u0000")) {
    return {
      ok: false,
      error: "This content contains invalid characters (NUL) and can't be saved.",
    };
  }
  if (byteLength(content) > MAX_CONTENT_BYTES) {
    return { ok: false, error: "This template is larger than 5 MB." };
  }
  if (type === "custom") return { ok: true, elementor: null };
  try {
    const data = parseElementor(content);
    return {
      ok: true,
      elementor: {
        kind: typeof data.type === "string" && data.type !== "" ? data.type : "template",
        widgets: countWidgets(data.content),
      },
    };
  } catch (error) {
    if (error instanceof EngineError) return { ok: false, error: error.message };
    throw error;
  }
}
