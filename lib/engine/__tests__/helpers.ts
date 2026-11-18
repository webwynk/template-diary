import { readFileSync } from "node:fs";
import path from "node:path";

import { parse, type DefaultTreeAdapterTypes as T } from "parse5";

import type { Detection } from "@/lib/engine/types";

export function fixture(name: string): string {
  return readFileSync(path.join(__dirname, "fixtures", name), "utf8");
}

/** Detection without snippets/line numbers noise, for compact snapshots. */
export function compact(d: Detection) {
  return {
    colors: d.colors.map((g) => ({
      rgb: g.rgb,
      count: g.count,
      formats: g.formats,
      occurrences: g.occurrences.map(
        (o) => `${o.raw} [${o.context}${o.varName ? ` ${o.varName}` : ""}] a=${o.alpha}`,
      ),
    })),
    images: d.images.map((i) => `${i.kind}: ${i.url}${i.warning ? ` (${i.warning})` : ""}`),
    fonts: d.fonts.map((f) => `${f.kind}: ${f.family} <${f.raw}>`),
    warnings: d.warnings,
  };
}

/** Everything that must never change: script contents, text nodes and comments (outside <style>). */
export function untouchable(html: string): string[] {
  const out: string[] = [];
  const visit = (nodes: T.ChildNode[], inStyle: boolean) => {
    for (const node of nodes) {
      if (node.nodeName === "#text" && !inStyle) out.push((node as T.TextNode).value);
      else if (node.nodeName === "#comment") out.push(`<!--${(node as T.CommentNode).data}-->`);
      else if ("childNodes" in node) {
        const el = node as T.Element;
        if (el.tagName === "template") visit((el as T.Template).content.childNodes, false);
        visit(el.childNodes, inStyle || el.tagName === "style");
      }
    }
  };
  visit(parse(html).childNodes, false);
  return out;
}
