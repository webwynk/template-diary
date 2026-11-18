// CSS scanning for Custom templates: <style> blocks and style="" attributes.
import type { AtRule, Declaration, Root } from "postcss";
import safeParse from "postcss-safe-parser";
import valueParser, { type Node as ValueNode } from "postcss-value-parser";

import { isNamedColor } from "@/lib/engine/colors";
import {
  addColor,
  addFont,
  addGoogleFonts,
  addImage,
  type Ctx,
  type Quote,
} from "@/lib/engine/custom/record";
import { GENERIC_FAMILIES } from "@/lib/engine/fonts";
import { lineAt } from "@/lib/engine/text";
import type { ColorContext } from "@/lib/engine/types";

/** Properties where a bare word like "red" means a color. Hex and color functions count anywhere. */
const NAMED_COLOR_PROPS =
  /^(color|background(-color)?|border(-(top|right|bottom|left|block|inline)(-(start|end))?)?(-color)?|outline(-color)?|box-shadow|text-shadow|text-decoration(-color)?|column-rule(-color)?|caret-color|accent-color|fill|stroke|stop-color|flood-color|lighting-color|scrollbar-color|text-emphasis(-color)?|-webkit-text-(fill|stroke)(-color)?|-webkit-tap-highlight-color)$/;

const COLOR_FUNCTIONS = new Set([
  "rgb",
  "rgba",
  "hsl",
  "hsla",
  "hwb",
  "lab",
  "lch",
  "oklab",
  "oklch",
  "color",
]);

const FONT_SIZE_RE =
  /^(0|[\d.]+(px|em|rem|%|pt|pc|vh|vw|vmin|vmax|ex|ch|cm|mm|in|q)|xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large|larger|smaller)$/i;

export interface CssRegion {
  css: string;
  base: number;
  context: "style-tag" | "style-attr";
  attrQuote?: '"' | "'";
}

// ---------------------------------------------------------------------------

export function scanCss(region: CssRegion, ctx: Ctx): void {
  // The tolerant parser recovers from broken CSS the way browsers do (unclosed blocks, stray
  // braces) and still reports exact source offsets.
  let root: Root;
  try {
    root = safeParse(region.css);
  } catch {
    ctx.warnings.push(
      `Some CSS near line ${lineAt(ctx.lines, region.base)} couldn't be read, so colors and fonts in it aren't listed.`,
    );
    return;
  }

  root.walkAtRules("import", (rule: AtRule) => {
    const urlMatch = /url\(\s*(['"]?)([^'")]+)\1\s*\)|(['"])([^'"]+)\3/.exec(rule.params);
    if (!urlMatch || rule.source?.start?.offset === undefined) return;
    const url = urlMatch[2] ?? urlMatch[4] ?? "";
    // Locate the URL text inside the at-rule source.
    const ruleStart = region.base + rule.source.start.offset;
    const ruleText = ctx.html.slice(
      ruleStart,
      ruleStart + 7 + (rule.raws.afterName?.length ?? 0) + rule.params.length + 2,
    );
    const idx = ruleText.indexOf(url);
    if (idx !== -1) addGoogleFonts(ctx, url, ruleStart + idx, "css-import", region.attrQuote);
  });

  root.walkDecls((decl: Declaration) => scanDeclaration(decl, region, ctx));
}

function insideFontFace(decl: Declaration): boolean {
  let p = decl.parent;
  while (p) {
    if (p.type === "atrule" && (p as AtRule).name.toLowerCase() === "font-face") return true;
    p = p.parent as typeof p;
  }
  return false;
}

function scanDeclaration(decl: Declaration, region: CssRegion, ctx: Ctx): void {
  const startOffset = decl.source?.start?.offset;
  if (startOffset === undefined) return;
  const raw = (decl.raws.value as { raw?: string } | undefined)?.raw ?? decl.value;
  const valueStart =
    region.base + startOffset + decl.prop.length + (decl.raws.between ?? ":").length;
  if (ctx.html.slice(valueStart, valueStart + raw.length) !== raw) {
    ctx.warnings.push(
      `Skipped a CSS value on line ${lineAt(ctx.lines, valueStart)} that couldn't be located exactly.`,
    );
    return;
  }

  const prop = decl.prop.toLowerCase();
  const isCustomProp = prop.startsWith("--");
  const fontFace = insideFontFace(decl);
  const allowNamed = isCustomProp || NAMED_COLOR_PROPS.test(prop);
  const colorContext: ColorContext = isCustomProp ? "css-var-def" : region.context;
  const parsed = valueParser(raw);

  parsed.walk((node: ValueNode) => {
    if (node.type === "function") {
      const fn = node.value.toLowerCase();
      if (fn === "url") {
        if (!fontFace) addCssUrl(ctx, node, valueStart, region.attrQuote);
        return false;
      }
      if (COLOR_FUNCTIONS.has(fn)) {
        const text = raw.slice(node.sourceIndex, node.sourceEndIndex);
        addColor(
          ctx,
          text,
          valueStart + node.sourceIndex,
          colorContext,
          isCustomProp ? decl.prop : undefined,
        );
        return false;
      }
      return undefined; // descend into var(), gradients, etc.
    }
    if (node.type === "word") {
      const w = node.value;
      if (w.startsWith("#") || (allowNamed && isNamedColor(w))) {
        addColor(
          ctx,
          w,
          valueStart + node.sourceIndex,
          colorContext,
          isCustomProp ? decl.prop : undefined,
        );
      }
    }
    return undefined;
  });

  if (!fontFace && (prop === "font-family" || prop === "font")) {
    addFontFamily(ctx, parsed.nodes, raw, valueStart, prop === "font", region.attrQuote);
  }
}

function addCssUrl(
  ctx: Ctx,
  node: valueParser.FunctionNode,
  valueStart: number,
  attrQuote?: Quote,
): void {
  const inner = node.nodes[0];
  if (!inner) return;
  if (inner.type === "string") {
    // sourceIndex points at the opening quote.
    addImage(ctx, inner.value, valueStart + inner.sourceIndex + 1, "css-url", attrQuote);
  } else if (inner.type === "word") {
    addImage(ctx, inner.value, valueStart + inner.sourceIndex, "css-url", attrQuote);
  }
}

function addFontFamily(
  ctx: Ctx,
  nodes: ValueNode[],
  raw: string,
  valueStart: number,
  shorthand: boolean,
  attrQuote?: Quote,
): void {
  let list = nodes;
  if (shorthand) {
    const sizeIdx = list.findIndex(
      (n) => n.type === "word" && FONT_SIZE_RE.test(n.value.split("/")[0]!),
    );
    if (sizeIdx === -1) return;
    let i = sizeIdx + 1;
    // optional "/ line-height"
    while (
      i < list.length &&
      (list[i]!.type === "space" || (list[i]!.type === "div" && list[i]!.value === "/"))
    ) {
      if (list[i]!.type === "div") {
        i++;
        while (i < list.length && list[i]!.type === "space") i++;
        i++; // the line-height value
        continue;
      }
      i++;
    }
    list = list.slice(i);
  }

  // First family = nodes up to the first comma.
  const firstComma = list.findIndex((n) => n.type === "div" && n.value === ",");
  const first = (firstComma === -1 ? list : list.slice(0, firstComma)).filter(
    (n) => n.type !== "space",
  );
  if (first.length === 0) return;
  if (first.some((n) => n.type === "function")) return; // var(), etc.
  const s = first[0]!.sourceIndex;
  const e = first[first.length - 1]!.sourceEndIndex;
  const text = raw.slice(s, e);
  const family =
    first.length === 1 && first[0]!.type === "string"
      ? first[0]!.value
      : first.map((n) => n.value).join(" ");
  if (!family || GENERIC_FAMILIES.has(family.toLowerCase())) return;
  addFont(ctx, family, text, valueStart + s, "font-family", attrQuote);
}

// ---------------------------------------------------------------------------
