// Detection for Custom templates (one combined HTML + CSS + JS box). DEVELOPMENT.md §6.2.
//
// Only CSS (<style> blocks and style="" attributes), SVG color attributes and known image/font
// attributes are scanned. <script> contents, text, and comments are never read or changed.
import { parse, type DefaultTreeAdapterTypes as T } from "parse5";

import { scanCss } from "@/lib/engine/custom/css";
import {
  addColor,
  addGoogleFonts,
  addImage,
  type Ctx,
  type Quote,
} from "@/lib/engine/custom/record";
import { groupColors } from "@/lib/engine/group";
import { lineStarts } from "@/lib/engine/text";
import type { Detection, Location } from "@/lib/engine/types";

const SVG_NS = "http://www.w3.org/2000/svg";
const SVG_COLOR_ATTRS = new Set([
  "fill",
  "stroke",
  "stop-color",
  "flood-color",
  "lighting-color",
  "color",
]);

export function detectCustom(html: string): Detection {
  const ctx: Ctx = {
    html,
    lines: lineStarts(html),
    colors: [],
    images: [],
    fonts: [],
    warnings: [],
  };
  const doc = parse(html, { sourceCodeLocationInfo: true });
  walk(doc.childNodes, ctx);

  return {
    colors: groupColors(ctx.colors),
    images: ctx.images.sort((a, b) => start(a) - start(b)),
    fonts: ctx.fonts.sort((a, b) => start(a) - start(b)),
    warnings: ctx.warnings,
  };
}

function start(o: { location: Location }): number {
  return o.location.kind === "range" ? o.location.start : 0;
}

// ---------------------------------------------------------------------------
// HTML walk
// ---------------------------------------------------------------------------

function isElement(node: T.ChildNode): node is T.Element {
  return "tagName" in node;
}

function walk(nodes: T.ChildNode[], ctx: Ctx): void {
  for (const node of nodes) {
    if (!isElement(node)) continue;
    const tag = node.tagName.toLowerCase();

    visitAttributes(node, tag, ctx);

    if (tag === "script") continue; // never read or change scripts
    if (tag === "style") {
      const text = node.childNodes[0];
      const loc = text && "sourceCodeLocation" in text ? text.sourceCodeLocation : null;
      if (loc) {
        scanCss(
          {
            css: html(ctx, loc.startOffset, loc.endOffset),
            base: loc.startOffset,
            context: "style-tag",
          },
          ctx,
        );
      }
      continue;
    }
    if (tag === "template" && "content" in node) {
      walk((node as T.Template).content.childNodes, ctx);
    }
    walk(node.childNodes, ctx);
  }
}

function html(ctx: Ctx, from: number, to: number): string {
  return ctx.html.slice(from, to);
}

interface AttrValue {
  value: string;
  start: number;
  end: number;
  quote?: Quote;
}

/** The exact source range of an attribute's value (inside its quotes, if any). */
function attrValue(ctx: Ctx, el: T.Element, name: string): AttrValue | null {
  const loc = el.sourceCodeLocation?.attrs?.[name];
  if (!loc) return null;
  const raw = html(ctx, loc.startOffset, loc.endOffset);
  const eq = raw.indexOf("=");
  if (eq === -1) return null; // boolean attribute
  let i = eq + 1;
  while (i < raw.length && /\s/.test(raw[i]!)) i++;
  const q = raw[i];
  if (q === '"' || q === "'") {
    const s = loc.startOffset + i + 1;
    const e = loc.endOffset - 1;
    return { value: html(ctx, s, e), start: s, end: e, quote: q };
  }
  const s = loc.startOffset + i;
  return { value: html(ctx, s, loc.endOffset), start: s, end: loc.endOffset };
}

function attr(el: T.Element, name: string): string | undefined {
  return el.attrs.find((a) => a.name === name)?.value;
}

function visitAttributes(el: T.Element, tag: string, ctx: Ctx): void {
  const style = attrValue(ctx, el, "style");
  if (style && style.value.trim()) {
    scanCss(
      { css: style.value, base: style.start, context: "style-attr", attrQuote: style.quote },
      ctx,
    );
  }

  if (el.namespaceURI === SVG_NS) {
    for (const a of el.attrs) {
      if (!SVG_COLOR_ATTRS.has(a.name)) continue;
      const v = attrValue(ctx, el, a.name);
      if (!v) continue;
      const trimmed = v.value.trim();
      const offset = v.value.indexOf(trimmed);
      addColor(ctx, trimmed, v.start + offset, "svg-attr");
    }
  }

  if (tag === "img") {
    const src = attrValue(ctx, el, "src");
    if (src)
      addImage(ctx, src.value.trim(), src.start + src.value.indexOf(src.value.trim()), "img-src");
  }
  if (tag === "img" || tag === "source") {
    const srcset = attrValue(ctx, el, "srcset");
    if (srcset) addSrcset(ctx, srcset);
  }
  if (tag === "video") {
    const poster = attrValue(ctx, el, "poster");
    if (poster)
      addImage(
        ctx,
        poster.value.trim(),
        poster.start + poster.value.indexOf(poster.value.trim()),
        "poster",
      );
  }
  if (tag === "link") {
    const href = attrValue(ctx, el, "href");
    if (!href) return;
    const rel = (attr(el, "rel") ?? "").toLowerCase();
    if (rel.includes("preload") && (attr(el, "as") ?? "").toLowerCase() === "image") {
      addImage(
        ctx,
        href.value.trim(),
        href.start + href.value.indexOf(href.value.trim()),
        "link-preload",
      );
    } else if (rel.includes("stylesheet")) {
      addGoogleFonts(ctx, href.value, href.start, "google-fonts-link");
    }
  }
}

function addSrcset(ctx: Ctx, v: AttrValue): void {
  // "a.jpg 1x, b.jpg 2x" — URLs are runs of non-space characters (a data: URI may contain commas,
  // so a candidate only ends at a comma that follows whitespace or a descriptor).
  const re = /(\S+?)(?:\s+[\d.]+[wx])?\s*(?:,|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(v.value)) && m[0].length > 0) {
    let url = m[1]!;
    if (url.endsWith(",")) url = url.slice(0, -1);
    if (url) addImage(ctx, url, v.start + m.index + m[0].indexOf(url), "srcset");
  }
}

// ---------------------------------------------------------------------------
// CSS
