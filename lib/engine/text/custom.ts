// Text tab for Custom templates (DEVELOPMENT.md §7 "Text tab", phase T1).
//
// Finds the visible text, link URLs and icons in the <body>, with exact source ranges, and groups
// them the way the section is built (heading area, repeated cards, list items). <script>, <style>,
// comments and other invisible parts are never read or changed. Every edit is applied at its
// exact range after checking the source still holds the detected value (RULES.md §6).
import { parse, type DefaultTreeAdapterTypes as T } from "parse5";

import { applyEdits, type Edit } from "@/lib/engine/custom/apply";
import {
  classTokens,
  hasIconClass,
  iconClasses,
  isLigatureIcon,
  keptClasses,
} from "@/lib/engine/text/icons";
import type {
  IconKind,
  TextField,
  TextFieldType,
  TextGroup,
  TextModel,
  TextRole,
} from "@/lib/engine/text/types";
import { lineAt, lineStarts } from "@/lib/engine/text";
import {
  type AppliedChange,
  type ApplyResult,
  EngineError,
  type IconAs,
  type TextSwap,
} from "@/lib/engine/types";

// ---------------------------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------------------------

/** Never read: invisible, raw text, or embedded documents. */
const SKIP = new Set([
  "script",
  "style",
  "noscript",
  "template",
  "textarea",
  "iframe",
  "object",
  "embed",
  "canvas",
  "video",
  "audio",
  "math",
  "head",
  "title",
  "select",
]);

/** Elements that may sit inside a run of text without breaking it into blocks. */
const INLINE = new Set([
  "a",
  "abbr",
  "b",
  "bdi",
  "bdo",
  "br",
  "cite",
  "code",
  "data",
  "dfn",
  "em",
  "i",
  "kbd",
  "mark",
  "q",
  "s",
  "samp",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "time",
  "u",
  "var",
  "wbr",
  "del",
  "ins",
  "label",
  "button",
  "font",
  "img",
  "svg",
]);

const ROW_TAGS = new Set(["li", "a", "button", "dt", "dd", "td", "tr", "option"]);
const SECTION_TAGS = new Set(["section", "header", "footer", "nav", "aside", "form", "article"]);
const HEADING_RE = /^h([1-6])$/;
const BUTTON_CLASS_RE = /(^|[-_])(btn|button|cta)([-_]|$)/i;
const EYEBROW_CLASS_RE =
  /(^|[-_])(eyebrow|kicker|overline|pretitle|pre-title|tagline|badge|chip|pill|label|subtitle-top|section-tag|tag)([-_]|$)/i;
const SUBHEADING_CLASS_RE =
  /(^|[-_])(subtitle|subheading|sub-heading|lead|description|desc|intro|excerpt)([-_]|$)/i;
const TITLE_CLASS_RE = /(^|[-_])(title|name|heading|headline)([-_]|$)/i;
const STATE_CLASSES = new Set([
  "active",
  "is-active",
  "show",
  "selected",
  "current",
  "open",
  "first",
  "last",
]);

const ASCII_WS = /[ \t\n\r\f]+/g;
const LEAD_WS = /^[ \t\n\r\f]*/;
const TRAIL_WS = /[ \t\n\r\f]*$/;

// ---------------------------------------------------------------------------------------------
// Raw fields (internal: carry what an edit needs)
// ---------------------------------------------------------------------------------------------

interface Range {
  start: number;
  end: number;
}

interface AttrRange extends Range {
  quote?: '"' | "'";
}

interface IconInfo {
  kind: IconKind;
  tokens: string[];
  classAttr?: AttrRange;
  srcAttr?: AttrRange;
  /** Ligature text range (trimmed). */
  text?: Range;
  width?: string;
  height?: string;
}

interface RawField {
  key: string;
  type: TextFieldType;
  value: string;
  /** The range a whole-value edit replaces. */
  range: Range;
  /** Element the field belongs to (block, link or icon element). */
  el: T.Element;
  /** Elements from the body down to `el` (inclusive), for grouping. */
  ancestors: T.Element[];
  /** Tags and classes of the block and any single wrappers it was unwrapped from. */
  roleTags: string[];
  roleClasses: string[];
  /** Inside an <a> or <button>. */
  inButton: boolean;
  /** Looks like a button: a <button>, or a btn/button/cta class on it or around it. */
  buttonStyled: boolean;
  icon?: IconInfo;
  iconValue?: string;
}

interface Ctx {
  html: string;
  fields: RawField[];
  paths: WeakMap<T.Element, string>;
  warnings: string[];
}

function isElement(node: T.ChildNode | T.Node): node is T.Element {
  return "tagName" in node;
}

function isText(node: T.ChildNode): node is T.TextNode {
  return node.nodeName === "#text";
}

function tagOf(el: T.Element): string {
  return el.tagName.toLowerCase();
}

function attr(el: T.Element, name: string): string | undefined {
  return el.attrs.find((a) => a.name === name)?.value;
}

/** The exact source range of an attribute's value (inside its quotes, if any). */
function attrRange(ctx: Ctx, el: T.Element, name: string): AttrRange | null {
  const loc = el.sourceCodeLocation?.attrs?.[name];
  if (!loc) return null;
  const raw = ctx.html.slice(loc.startOffset, loc.endOffset);
  const eq = raw.indexOf("=");
  if (eq === -1) return null;
  let i = eq + 1;
  while (i < raw.length && /\s/.test(raw[i]!)) i++;
  const q = raw[i];
  if (q === '"' || q === "'")
    return { start: loc.startOffset + i + 1, end: loc.endOffset - 1, quote: q };
  return { start: loc.startOffset + i, end: loc.endOffset };
}

function outerRange(el: T.Element): Range | null {
  const loc = el.sourceCodeLocation;
  if (!loc?.startTag) return null;
  const start = loc.startTag.startOffset;
  if (loc.endTag) return { start, end: loc.endTag.endOffset };
  // Void elements, and self-closing SVG ("<svg …/>") which has no end tag.
  if (VOID.has(tagOf(el)) || (tagOf(el) === "svg" && el.childNodes.length === 0)) {
    return { start, end: loc.startTag.endOffset };
  }
  return null;
}

const VOID = new Set(["img", "br", "wbr", "input", "hr", "source", "meta", "link"]);

function collapse(text: string): string {
  return text.replace(ASCII_WS, " ").replace(LEAD_WS, "").replace(TRAIL_WS, "");
}

/** Range of a text node without leading/trailing ASCII whitespace. */
function trimmedRange(ctx: Ctx, node: T.ChildNode): Range | null {
  const loc = node.sourceCodeLocation;
  if (!loc) return null;
  const raw = ctx.html.slice(loc.startOffset, loc.endOffset);
  const lead = LEAD_WS.exec(raw)![0].length;
  const trail = TRAIL_WS.exec(raw)![0].length;
  if (lead + trail >= raw.length) return null;
  return { start: loc.startOffset + lead, end: loc.endOffset - trail };
}

function hasVisibleText(node: T.ChildNode): boolean {
  if (isText(node)) return collapse(node.value) !== "";
  if (!isElement(node)) return false;
  const tag = tagOf(node);
  if (SKIP.has(tag) || tag === "svg") return false;
  if (isFontIcon(node)) return false;
  return node.childNodes.some(hasVisibleText);
}

function isFontIcon(el: T.Element): boolean {
  const tag = tagOf(el);
  if (tag !== "i" && tag !== "span" && tag !== "em") return false;
  const tokens = classTokens(attr(el, "class"));
  if (!hasIconClass(tokens)) return false;
  if (isLigatureIcon(tokens)) return true;
  // Font icons have no text of their own ("fa fa-star" with text is styled text, not an icon).
  return el.childNodes.every((c) => (isText(c) ? collapse(c.value) === "" : !isElement(c)));
}

function numericSize(v: string | undefined): number | null {
  if (!v) return null;
  const m = /^\s*(\d+(?:\.\d+)?)(px)?\s*$/.exec(v);
  return m ? Number(m[1]) : null;
}

/** Inline SVGs are icons unless they say they're large (illustrations). */
function isSvgIcon(el: T.Element): boolean {
  const w = numericSize(attr(el, "width"));
  const h = numericSize(attr(el, "height"));
  return !((w !== null && w > 128) || (h !== null && h > 128));
}

/** Small images or images marked as icons; other images belong to the palette. */
function isImgIcon(el: T.Element): boolean {
  const own = attr(el, "class") ?? "";
  const parent =
    el.parentNode && isElement(el.parentNode) ? (attr(el.parentNode, "class") ?? "") : "";
  if (/(^|[-_\s])icon/i.test(own) || /(^|[-_\s])icon/i.test(parent)) return true;
  const w = numericSize(attr(el, "width"));
  const h = numericSize(attr(el, "height"));
  return w !== null && h !== null && w <= 64 && h <= 64;
}

function isIconElement(node: T.ChildNode): node is T.Element {
  if (!isElement(node)) return false;
  const tag = tagOf(node);
  if (tag === "svg") return isSvgIcon(node);
  if (tag === "img") return isImgIcon(node);
  return isFontIcon(node);
}

/** Only text, comments and inline elements (recursively) inside. */
function isInlinePure(el: T.Element): boolean {
  return el.childNodes.every((c) => {
    if (!isElement(c)) return true;
    const tag = tagOf(c);
    if (!INLINE.has(tag)) return false;
    if (tag === "svg" || tag === "img" || tag === "br" || tag === "wbr") return true;
    return isInlinePure(c);
  });
}

function isTextBlock(el: T.Element): boolean {
  const tag = tagOf(el);
  if (SKIP.has(tag) || VOID.has(tag) || tag === "svg") return false;
  if (!isInlinePure(el) || !el.childNodes.some(hasVisibleText)) return false;
  // A row of links or buttons ("<nav><a>Home</a> <a>About</a></nav>") is several fields.
  const controls = el.childNodes.filter(
    (c) => isElement(c) && (tagOf(c) === "a" || tagOf(c) === "button"),
  );
  const looseText = el.childNodes.some((c) => isText(c) && collapse(c.value) !== "");
  return controls.length < 2 || looseText;
}

function isButtonStyled(els: T.Element[]): boolean {
  return els.some((e) => tagOf(e) === "button" || BUTTON_CLASS_RE.test(attr(e, "class") ?? ""));
}

function isButtonish(el: T.Element): boolean {
  const tag = tagOf(el);
  return tag === "a" || tag === "button" || BUTTON_CLASS_RE.test(attr(el, "class") ?? "");
}

// ---------------------------------------------------------------------------------------------
// Walk
// ---------------------------------------------------------------------------------------------

function findBody(doc: T.Document): T.Element | null {
  const html = doc.childNodes.find((n): n is T.Element => isElement(n) && tagOf(n) === "html");
  return html?.childNodes.find((n): n is T.Element => isElement(n) && tagOf(n) === "body") ?? null;
}

function childPath(ctx: Ctx, parent: T.Element, parentPath: string, child: T.Element): string {
  const tag = tagOf(child);
  let index = 0;
  for (const c of parent.childNodes) {
    if (c === child) break;
    if (isElement(c) && tagOf(c) === tag) index++;
  }
  const path = `${parentPath ? `${parentPath}/` : ""}${tag}[${index}]`;
  ctx.paths.set(child, path);
  return path;
}

export function detectRawCustom(html: string): {
  fields: RawField[];
  warnings: string[];
  paths: WeakMap<T.Element, string>;
} {
  const ctx: Ctx = { html, fields: [], paths: new WeakMap(), warnings: [] };
  const doc = parse(html, { sourceCodeLocationInfo: true });
  const body = findBody(doc);
  if (body) {
    ctx.paths.set(body, "");
    visitChildren(ctx, body, "", []);
  }
  return { fields: ctx.fields, warnings: ctx.warnings, paths: ctx.paths };
}

function visitChildren(ctx: Ctx, el: T.Element, path: string, ancestors: T.Element[]): void {
  let textIndex = 0;
  for (const child of el.childNodes) {
    if (isText(child)) {
      if (collapse(child.value) === "") continue;
      const range = trimmedRange(ctx, child);
      const index = textIndex++;
      if (!range) continue;
      ctx.fields.push({
        key: `${path ? `${path}/` : ""}#text[${index}]|text`,
        type: "text",
        value: collapse(child.value),
        range,
        el,
        ancestors,
        roleTags: [tagOf(el)],
        roleClasses: classTokens(attr(el, "class")),
        inButton: ancestors.some(isButtonish),
        buttonStyled: isButtonStyled(ancestors),
      });
    } else if (isElement(child)) {
      const childP = childPath(ctx, el, path, child);
      visit(ctx, child, childP, [...ancestors, child]);
    }
  }
}

function visit(ctx: Ctx, el: T.Element, path: string, ancestors: T.Element[]): void {
  const tag = tagOf(el);
  if (SKIP.has(tag)) return;
  if (tag === "svg" || tag === "img") {
    if (isIconElement(el)) addIcon(ctx, el, path, ancestors);
    return;
  }
  if (isFontIcon(el)) {
    addIcon(ctx, el, path, ancestors);
    return;
  }
  if (tag === "a") addLink(ctx, el, path, ancestors);
  if (isTextBlock(el)) {
    addBlock(ctx, el, path, ancestors, [], []);
    return;
  }
  visitChildren(ctx, el, path, ancestors);
}

function addLink(ctx: Ctx, el: T.Element, path: string, ancestors: T.Element[]): void {
  const href = attr(el, "href");
  if (href === undefined) return;
  const range = attrRange(ctx, el, "href");
  if (!range) return;
  ctx.fields.push({
    key: `${path}|href`,
    type: "link",
    value: href,
    range,
    el,
    ancestors,
    roleTags: ["a"],
    roleClasses: classTokens(attr(el, "class")),
    inButton: true,
    buttonStyled: isButtonStyled(ancestors),
  });
}

function addIcon(ctx: Ctx, el: T.Element, path: string, ancestors: T.Element[]): void {
  const range = outerRange(el);
  if (!range) return;
  const tag = tagOf(el);
  const tokens = classTokens(attr(el, "class"));
  const classAttr = attrRange(ctx, el, "class") ?? undefined;
  let icon: IconInfo;
  let iconValue: string | undefined;
  if (tag === "svg") {
    icon = { kind: "svg", tokens, classAttr, width: attr(el, "width"), height: attr(el, "height") };
  } else if (tag === "img") {
    const srcAttr = attrRange(ctx, el, "src") ?? undefined;
    icon = {
      kind: "image",
      tokens,
      classAttr,
      srcAttr,
      width: attr(el, "width"),
      height: attr(el, "height"),
    };
    iconValue = attr(el, "src") ?? "";
  } else if (isLigatureIcon(tokens)) {
    const textNode = el.childNodes.find((c) => isText(c) && collapse(c.value) !== "");
    const text = textNode ? (trimmedRange(ctx, textNode) ?? undefined) : undefined;
    icon = { kind: "ligature", tokens, classAttr, text };
    iconValue = textNode && isText(textNode) ? collapse(textNode.value) : "";
  } else {
    icon = { kind: "font", tokens, classAttr };
    iconValue = iconClasses(tokens);
  }
  const parent = ancestors.at(-2);
  ctx.fields.push({
    key: `${path}|icon`,
    type: "icon",
    value: ctx.html.slice(range.start, range.end),
    range,
    el,
    ancestors,
    roleTags: [tag],
    roleClasses: [...tokens, ...classTokens(parent ? attr(parent, "class") : undefined)],
    inButton: ancestors.slice(0, -1).some(isButtonish),
    buttonStyled: isButtonStyled(ancestors.slice(0, -1)),
    icon,
    ...(iconValue !== undefined ? { iconValue } : {}),
  });
}

/** Meaningful children: no comments and no whitespace-only text. */
function meaningful(nodes: T.ChildNode[]): T.ChildNode[] {
  return nodes.filter((n) => (isText(n) ? collapse(n.value) !== "" : isElement(n)));
}

function addBlock(
  ctx: Ctx,
  el: T.Element,
  path: string,
  ancestors: T.Element[],
  outerTags: string[],
  outerClasses: string[],
): void {
  const nodes = meaningful(el.childNodes);
  // Icons at the start or end ("<a><i class=…></i> Learn more</a>") are fields of their own.
  let first = 0;
  let last = nodes.length - 1;
  const edgeIcons: T.Element[] = [];
  while (first <= last && isIconElement(nodes[first]!)) edgeIcons.push(nodes[first++] as T.Element);
  while (last >= first && isIconElement(nodes[last]!)) edgeIcons.push(nodes[last--] as T.Element);
  for (const icon of edgeIcons) {
    const p = childPath(ctx, el, path, icon);
    addIcon(ctx, icon, p, [...ancestors, icon]);
  }
  const core = nodes.slice(first, last + 1);
  if (core.length === 0) return;

  const roleTags = [...outerTags, tagOf(el)];
  const roleClasses = [...outerClasses, ...classTokens(attr(el, "class"))];
  const inButton = ancestors.some(isButtonish);

  // A single wrapper ("<h3><span>Title</span></h3>", "<p><a href>Read more</a></p>"): the field
  // belongs to the innermost element, so its link and classes are used too.
  if (core.length === 1 && isElement(core[0]!) && !VOID.has(tagOf(core[0]))) {
    const inner = core[0];
    const innerTag = tagOf(inner);
    if (innerTag !== "svg" && innerTag !== "br") {
      const p = childPath(ctx, el, path, inner);
      const innerAncestors = [...ancestors, inner];
      if (innerTag === "a") addLink(ctx, inner, p, innerAncestors);
      addBlock(ctx, inner, p, innerAncestors, roleTags, roleClasses);
      return;
    }
  }

  let type: TextFieldType;
  let range: Range | null;
  let value: string;
  const only = core[0]!;
  if (core.length === 1 && isText(only)) {
    type = "text";
    range = trimmedRange(ctx, only);
    value = collapse(only.value);
  } else {
    type = "html";
    const firstLoc = core[0]!.sourceCodeLocation;
    const lastLoc = core.at(-1)!.sourceCodeLocation;
    if (!firstLoc || !lastLoc) return;
    let start = firstLoc.startOffset;
    let end = lastLoc.endOffset;
    // Edge text nodes keep their outer whitespace out of the field.
    if (isText(core[0]!)) start += LEAD_WS.exec(ctx.html.slice(start, end))![0].length;
    if (isText(core.at(-1)!)) end -= TRAIL_WS.exec(ctx.html.slice(start, end))![0].length;
    range = { start, end };
    value = ctx.html.slice(start, end);
  }
  if (!range || !value) return;
  ctx.fields.push({
    key: `${path}|text`,
    type,
    value,
    range,
    el,
    ancestors,
    roleTags,
    roleClasses,
    inButton:
      inButton ||
      roleTags.some((t) => t === "a" || t === "button") ||
      roleClasses.some((c) => BUTTON_CLASS_RE.test(c)),
    buttonStyled:
      isButtonStyled(ancestors) ||
      roleTags.includes("button") ||
      roleClasses.some((c) => BUTTON_CLASS_RE.test(c)),
  });
}

// ---------------------------------------------------------------------------------------------
// Grouping and labels
// ---------------------------------------------------------------------------------------------

const UTIL_RE =
  /^(?:p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|ms|me|w|h|min|max|size|text|bg|border|rounded|shadow|flex|grid|gap|col|cols|row|items|justify|self|place|order|z|top|left|right|bottom|inset|opacity|font|leading|tracking|space|d|align|overflow|position|is|has|js|aos|animate|animated|transition|duration|ease|delay|hover|focus|group|peer|container|wrapper|inner|outer|section|clearfix|relative|absolute|fixed|sticky|block|inline|hidden|visible|mx-auto|wow|fade|slide|elementor|e|swiper|owl|g|offset|float|fw|fs|lh|ratio)(?:-|$)/i;

function descriptiveClasses(tokens: string[]): string[] {
  return tokens.filter(
    (t) =>
      /^[a-z][a-z0-9_-]*[a-z0-9]$/i.test(t) &&
      t.length >= 3 &&
      !UTIL_RE.test(t) &&
      !STATE_CLASSES.has(t) &&
      !/\d{2,}/.test(t),
  );
}

/** "feature-card__inner" → "Feature card", "hero-section" → "Hero". */
function humanize(token: string): string {
  const block = token.split(/__|--/)[0]!;
  const words = block
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
  while (
    words.length > 1 &&
    ["section", "wrapper", "container", "area", "block", "wrap", "box", "inner"].includes(
      words.at(-1)!,
    )
  )
    words.pop();
  const text = words.join(" ");
  return text ? text[0]!.toUpperCase() + text.slice(1) : "";
}

const CARD_WORD_RE =
  /(card|item|box|feature|service|plan|pricing|price|member|team|testimonial|review|step|faq|post|product|stat|counter|slide|tab|accordion|benefit|tile|column|panel|block|entry|project|work|client|logo)/i;

function setLabel(el: T.Element, card: boolean): string {
  const tokens = classTokens(attr(el, "class"));
  if (tagOf(el) === "button" || tokens.some((t) => BUTTON_CLASS_RE.test(t))) return "Button";
  const classes = descriptiveClasses(tokens);
  const preferred = classes.find((c) => CARD_WORD_RE.test(c)) ?? classes[0];
  const label = preferred ? humanize(preferred) : "";
  if (label) return label;
  return card && tagOf(el) !== "li" ? "Card" : "Item";
}

function signature(el: T.Element): string {
  const classes = classTokens(attr(el, "class"))
    .filter((c) => !STATE_CLASSES.has(c))
    .sort();
  return `${tagOf(el)}.${classes.join(".")}`;
}

interface SetMember {
  index: number;
  label: string;
  card: boolean;
}

function findRepeats(fields: RawField[]): Map<T.Element, SetMember> {
  const counts = new Map<T.Element, number>();
  for (const f of fields) {
    if (f.type === "link" || f.type === "icon") continue;
    for (const a of f.ancestors) counts.set(a, (counts.get(a) ?? 0) + 1);
  }
  const withFields = new Set<T.Element>();
  for (const f of fields) for (const a of f.ancestors) withFields.add(a);

  const parents = new Set<T.Element>();
  for (const el of withFields) {
    if (el.parentNode && isElement(el.parentNode)) parents.add(el.parentNode);
  }
  const members = new Map<T.Element, SetMember>();
  for (const parent of parents) {
    const bySig = new Map<string, T.Element[]>();
    for (const c of parent.childNodes) {
      if (!isElement(c) || !withFields.has(c)) continue;
      const sig = signature(c);
      bySig.set(sig, [...(bySig.get(sig) ?? []), c]);
    }
    for (const items of bySig.values()) {
      if (items.length < 2) continue;
      const tag = tagOf(items[0]!);
      // Repeated sections are sections, not cards.
      if (SECTION_TAGS.has(tag) && tag !== "article") continue;
      const card = Math.max(...items.map((i) => counts.get(i) ?? 0)) >= 2;
      // Paragraphs or headings in a row are just text; list items, links and buttons are rows.
      if (!card && !ROW_TAGS.has(tag)) continue;
      const label = setLabel(items[0]!, card);
      items.forEach((el, i) => members.set(el, { index: i + 1, label, card }));
    }
  }
  return members;
}

interface Placed {
  field: RawField;
  groupKey: string;
  /** Item row index and label outside cards, or nested inside a card. */
  item?: { index: number; label: string };
}

interface GroupDraft {
  key: string;
  kind: TextGroup["kind"];
  section: T.Element | null;
  card?: { index: number; label: string };
  placed: Placed[];
}

function sectionOf(f: RawField): T.Element | null {
  for (let i = f.ancestors.length - 1; i >= 0; i--) {
    if (SECTION_TAGS.has(tagOf(f.ancestors[i]!))) return f.ancestors[i]!;
  }
  return null;
}

function sectionLabel(el: T.Element | null): string | null {
  if (!el) return "Page";
  const aria = attr(el, "aria-label")?.trim();
  if (aria) return aria.slice(0, 40);
  const id = attr(el, "id");
  if (id && /^[a-z][a-z0-9_-]*$/i.test(id)) {
    const h = humanize(id);
    if (h) return h;
  }
  const cls = descriptiveClasses(classTokens(attr(el, "class")))[0];
  if (cls) return humanize(cls);
  const tag = tagOf(el);
  if (tag === "header") return "Header";
  if (tag === "footer") return "Footer";
  if (tag === "nav") return "Navigation";
  return null;
}

function headingLevel(f: RawField): number | null {
  for (const t of f.roleTags) {
    const m = HEADING_RE.exec(t);
    if (m) return Number(m[1]);
  }
  return null;
}

function textLength(f: RawField): number {
  return f.type === "html" ? collapse(f.value.replace(/<[^>]*>/g, "")).length : f.value.length;
}

const ROLE_LABEL: Record<TextRole, string> = {
  eyebrow: "Eyebrow",
  title: "Title",
  heading: "Heading",
  subheading: "Subheading",
  text: "Text",
  button: "Button",
  link: "Link",
  icon: "Icon",
  item: "Item",
};

function labelGroup(draft: GroupDraft): TextField[] {
  const placed = draft.placed;
  const roles = new Map<Placed, TextRole>();
  const labels = new Map<Placed, string>();
  const isCard = draft.kind === "card";
  const texts = placed.filter((p) => p.field.type === "text" || p.field.type === "html");
  const free = texts.filter((p) => !p.item && !p.field.inButton);

  // Title: the most important heading; in cards without one, a title-like class or a short
  // first line followed by more text.
  let title: Placed | undefined;
  let best = 7;
  for (const p of free) {
    const level = headingLevel(p.field);
    if (level !== null && level < best) {
      best = level;
      title = p;
    }
  }
  if (!title) title = free.find((p) => p.field.roleClasses.some((c) => TITLE_CLASS_RE.test(c)));
  if (!title && isCard && free.length >= 2 && textLength(free[0]!.field) <= 80) title = free[0];
  if (title) roles.set(title, "title");

  if (title) {
    const titleAt = free.indexOf(title);
    const before = free[titleAt - 1];
    if (
      before &&
      textLength(before.field) <= 60 &&
      (headingLevel(before.field) === null || headingLevel(before.field)! > best)
    ) {
      roles.set(before, "eyebrow");
    }
    if (!isCard) {
      const after = free
        .slice(titleAt + 1)
        .find((p) => !roles.has(p) && headingLevel(p.field) === null);
      if (after) roles.set(after, "subheading");
    }
  }
  for (const p of free) {
    if (roles.has(p)) continue;
    if (
      p.field.roleClasses.some((c) => EYEBROW_CLASS_RE.test(c)) &&
      textLength(p.field) <= 60 &&
      (!title || free.indexOf(p) < free.indexOf(title))
    ) {
      roles.set(p, "eyebrow");
    } else if (
      !isCard &&
      title &&
      free.indexOf(p) > free.indexOf(title) &&
      p.field.roleClasses.some((c) => SUBHEADING_CLASS_RE.test(c)) &&
      ![...roles.values()].includes("subheading")
    ) {
      roles.set(p, "subheading");
    }
  }

  // What a link or an icon belongs to: the text inside the same <a>/<button>.
  const anchorOf = (f: RawField): T.Element | undefined => {
    const list = f.type === "link" ? f.ancestors : f.ancestors.slice(0, -1);
    for (let i = list.length - 1; i >= 0; i--) {
      const tag = tagOf(list[i]!);
      if (tag === "a" || tag === "button") return list[i];
    }
    return undefined;
  };
  const owners = new Map<Placed, Placed>();
  for (const p of placed) {
    if (p.field.type !== "link" && !(p.field.type === "icon" && p.field.inButton)) continue;
    const anchor = anchorOf(p.field);
    if (!anchor) continue;
    const owner = texts.find((q) => q.field.el === anchor || q.field.ancestors.includes(anchor));
    if (owner && owner.item?.index === p.item?.index) owners.set(p, owner);
  }

  for (const p of placed) {
    if (roles.has(p)) continue;
    const f = p.field;
    if (p.item) roles.set(p, "item");
    else if (f.type === "icon") roles.set(p, "icon");
    else if (f.type === "link") roles.set(p, "link");
    else if (f.inButton) roles.set(p, f.buttonStyled ? "button" : "link");
    else if (headingLevel(f) !== null) roles.set(p, "heading");
    else roles.set(p, "text");
  }

  // Base labels for fields that stand on their own; attached links and icons are named after
  // their owner ("Button 2 link", "Button 2 icon").
  const itemTexts = new Map<string, number>();
  for (const p of placed) {
    if (owners.has(p)) continue;
    const role = roles.get(p)!;
    if (p.item) {
      const base = `${p.item.label} ${p.item.index}`;
      const itemKey = `${p.item.label}#${p.item.index}`;
      const isText = p.field.type === "text" || p.field.type === "html";
      const k = (itemTexts.get(itemKey) ?? 0) + (isText ? 1 : 0);
      itemTexts.set(itemKey, k);
      labels.set(
        p,
        p.field.type === "icon"
          ? `${base} icon`
          : p.field.type === "link"
            ? `${base} link`
            : k > 1
              ? `${base} · ${k}`
              : base,
      );
    } else {
      labels.set(p, p.field.type === "link" ? "Link URL" : ROLE_LABEL[role]);
    }
  }
  numberDuplicates(
    placed.filter((p) => !p.item && !owners.has(p)),
    labels,
  );
  for (const [p, owner] of owners) {
    const name = labels.get(owner)!;
    const suffix = p.field.type === "icon" ? "icon" : /^Link( \d+)?$/.test(name) ? "URL" : "link";
    labels.set(p, `${name} ${suffix}`);
  }
  numberDuplicates([...owners.keys()], labels);

  // Order: each field in document order, with its attached icon and link right after it.
  const ordered: Placed[] = [];
  for (const p of placed) {
    if (owners.has(p)) continue;
    ordered.push(p);
    for (const kind of ["icon", "link"] as const) {
      for (const [q, owner] of owners) if (owner === p && q.field.type === kind) ordered.push(q);
    }
  }

  return ordered.map((p) => ({
    key: p.field.key,
    role: roles.get(p)!,
    label: labels.get(p)!,
    type: p.field.type,
    value: p.field.value,
    ...(p.field.icon ? { iconKind: p.field.icon.kind } : {}),
    ...(p.field.iconValue !== undefined ? { iconValue: p.field.iconValue } : {}),
    location: {
      kind: "range" as const,
      start: p.field.range.start,
      end: p.field.range.end,
      line: 0,
    },
  }));
}

function numberDuplicates(list: Placed[], labels: Map<Placed, string>): void {
  const counts = new Map<string, number>();
  for (const p of list) counts.set(labels.get(p)!, (counts.get(labels.get(p)!) ?? 0) + 1);
  const seen = new Map<string, number>();
  for (const p of list) {
    const label = labels.get(p)!;
    if (counts.get(label)! < 2) continue;
    const n = (seen.get(label) ?? 0) + 1;
    seen.set(label, n);
    labels.set(p, `${label} ${n}`);
  }
}

export function detectTextCustom(html: string): TextModel {
  const { fields, warnings, paths } = detectRawCustom(html);
  const members = findRepeats(fields);
  const drafts: GroupDraft[] = [];
  const byKey = new Map<string, GroupDraft>();
  const runCount = new Map<T.Element | null, number>();
  let current: GroupDraft | null = null;

  for (const f of fields) {
    let cardEl: T.Element | undefined;
    let item: Placed["item"];
    for (const a of f.ancestors) {
      const m = members.get(a);
      if (!m) continue;
      if (!cardEl && m.card) cardEl = a;
      else if (!m.card || cardEl) item = { index: m.index, label: cardEl ? "Item" : m.label };
    }
    // A card's own element can't be an item row of itself.
    const section = sectionOf(f);
    let draft: GroupDraft;
    if (cardEl) {
      const key = paths.get(cardEl) ?? "";
      draft = byKey.get(key) ?? {
        key,
        kind: "card",
        section,
        card: { index: members.get(cardEl)!.index, label: members.get(cardEl)!.label },
        placed: [],
      };
      if (!byKey.has(key)) {
        byKey.set(key, draft);
        drafts.push(draft);
      }
      current = null;
    } else {
      if (!current || current.section !== section) {
        const n: number = (runCount.get(section) ?? 0) + 1;
        runCount.set(section, n);
        const sectionKey: string = section ? (paths.get(section) ?? "") : "";
        current = { key: `${sectionKey}~${n}`, kind: "content", section, placed: [] };
        drafts.push(current);
      }
      draft = current;
    }
    draft.placed.push({ field: f, groupKey: draft.key, ...(item ? { item } : {}) });
  }

  // Section names are shown only when there is more than one section.
  const sections: (T.Element | null)[] = [];
  for (const d of drafts) if (!sections.includes(d.section)) sections.push(d.section);
  const multi = sections.length > 1;
  const sectionNames = new Map<T.Element | null, string>();
  let plainIndex = 0;
  for (const sec of sections) sectionNames.set(sec, sectionLabel(sec) ?? `Section ${++plainIndex}`);

  const starts = lineStarts(html);
  const groups: TextGroup[] = [];
  const runLabels = new Map<T.Element | null, number>();
  for (const d of drafts) {
    const fieldsOut = labelGroup(d).map((f) =>
      f.location.kind === "range"
        ? { ...f, location: { ...f.location, line: lineAt(starts, f.location.start) } }
        : f,
    );
    let label: string;
    let kind: TextGroup["kind"] = d.kind;
    if (d.card) {
      label = `${d.card.label} ${d.card.index}`;
    } else if (fieldsOut.some((f) => f.role === "title")) {
      label = "Heading";
      kind = "heading";
    } else {
      const n = (runLabels.get(d.section) ?? 0) + 1;
      runLabels.set(d.section, n);
      label = n === 1 ? "Content" : `Content ${n}`;
    }
    if (multi) label = `${sectionNames.get(d.section)} · ${label}`;
    groups.push({ key: d.key, kind, label, fields: fieldsOut });
  }
  // Two "Heading" groups in one section get numbers.
  const seen = new Map<string, number>();
  const total = new Map<string, number>();
  for (const g of groups) total.set(g.label, (total.get(g.label) ?? 0) + 1);
  for (const g of groups) {
    if (total.get(g.label)! < 2) continue;
    const n = (seen.get(g.label) ?? 0) + 1;
    seen.set(g.label, n);
    g.label = `${g.label} ${n}`;
  }
  return { groups, warnings };
}

// ---------------------------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------------------------

/** Plain text → HTML text: & < > escaped, non-breaking spaces kept visible. */
export function encodeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/ /g, "&nbsp;");
}

function encodeAttr(value: string, quote: '"' | "'" | undefined): string {
  const amp = value.replace(/&/g, "&amp;");
  if (quote === "'") return amp.replace(/'/g, "&#39;");
  if (quote === '"') return amp.replace(/"/g, "&quot;");
  return `"${amp.replace(/"/g, "&quot;")}"`;
}

function attrText(name: string, value: string): string {
  return ` ${name}="${value.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"`;
}

const STALE = "The text changed while applying your edits. Nothing was changed.";

function shorten(text: string): string {
  return text.length > 200 ? `${text.slice(0, 199)}…` : text;
}

export function applyTextCustom(html: string, swaps: TextSwap[]): ApplyResult {
  if (swaps.length === 0) return { content: html, applied: [] };
  const { fields } = detectRawCustom(html);
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const edits: Edit[] = [];
  const applied: AppliedChange[] = [];
  const push = (range: Range, text: string) =>
    edits.push({ ...range, raw: html.slice(range.start, range.end), text });

  for (const swap of swaps) {
    const f = byKey.get(swap.key);
    if (!f)
      throw new EngineError(
        "A text field you edited is no longer in the code. Nothing was changed.",
      );
    if (f.value !== swap.from) throw new EngineError(STALE);
    const before = edits.length;

    if (swap.kind === "text") {
      if (f.type !== "text" && f.type !== "html") throw new EngineError(STALE);
      if (swap.to !== f.value) push(f.range, f.type === "text" ? encodeText(swap.to) : swap.to);
    } else if (swap.kind === "link") {
      if (f.type !== "link") throw new EngineError(STALE);
      const range = f.range as AttrRange;
      if (swap.to !== f.value) push(range, encodeAttr(swap.to, range.quote));
    } else {
      if (f.type !== "icon" || !f.icon) throw new EngineError(STALE);
      iconEdit(f, f.icon, swap.as, swap.to.trim(), push);
    }

    if (edits.length > before) {
      applied.push({
        kind: swap.kind,
        key: swap.key,
        from: shorten(swap.from),
        to: shorten(swap.to.trim()),
        count: 1,
      });
    }
  }
  return { content: applyEdits(html, edits), applied };
}

function iconEdit(
  f: RawField,
  icon: IconInfo,
  as: IconAs,
  to: string,
  push: (range: Range, text: string) => void,
): void {
  const kept = keptClasses(icon.tokens);
  const size = `${icon.width ? attrText("width", icon.width) : ""}${icon.height ? attrText("height", icon.height) : ""}`;

  if (as === "class") {
    const next = [...kept, ...classTokens(to)]
      .filter((t, i, all) => all.indexOf(t) === i)
      .join(" ");
    if (icon.kind === "font" && icon.classAttr) {
      if (
        iconClasses(icon.tokens) !== iconClasses(classTokens(to)) ||
        next !== icon.tokens.join(" ")
      ) {
        push(icon.classAttr, encodeAttr(next, icon.classAttr.quote));
      }
      return;
    }
    push(f.range, `<i${attrText("class", next)} aria-hidden="true"></i>`);
    return;
  }
  if (as === "svg") {
    if (to !== f.value) push(f.range, to);
    return;
  }
  if (as === "image") {
    if (icon.kind === "image" && icon.srcAttr) {
      if (to !== f.iconValue) push(icon.srcAttr, encodeAttr(to, icon.srcAttr.quote));
      return;
    }
    const cls = kept.length ? attrText("class", kept.join(" ")) : "";
    push(f.range, `<img${attrText("src", to)} alt=""${cls}${size}>`);
    return;
  }
  // ligature
  if (icon.kind === "ligature" && icon.text) {
    if (to !== f.iconValue) push(icon.text, to);
    return;
  }
  const cls = [...kept, "material-icons"].join(" ");
  push(f.range, `<span${attrText("class", cls)} aria-hidden="true">${to}</span>`);
}

// ---------------------------------------------------------------------------------------------
// Click to edit (phase T4): mark text in the preview copy
// ---------------------------------------------------------------------------------------------

/** The attribute the preview bridge looks for. Only ever added to the preview copy. */
export const TEXT_KEY_ATTR = "data-td-key";

/**
 * The same HTML with `data-td-key="<field key>"` on the element of each field, so a click in the
 * preview can open that field. Never saved: only the preview's srcdoc is built from this.
 * When one element holds several fields, its own text or icon wins over its link, and both win
 * over loose text inside it ("<div>Hello <b>x</b></div>" marks the div with "#text[0]").
 */
export function annotateTextCustom(html: string): string {
  const { fields } = detectRawCustom(html);
  const best = new Map<T.Element, { key: string; rank: number }>();
  for (const f of fields) {
    const rank = f.key.includes("#text[") ? 2 : f.type === "link" ? 1 : 0;
    const prev = best.get(f.el);
    if (!prev || rank < prev.rank) best.set(f.el, { key: f.key, rank });
  }
  const inserts: { at: number; text: string }[] = [];
  for (const [el, { key }] of best) {
    const tag = el.sourceCodeLocation?.startTag;
    if (!tag) continue;
    // Before the closing ">" (or "/>" of a self-closing tag).
    let at = tag.endOffset - 1;
    if (html[at] !== ">") continue;
    if (html[at - 1] === "/") at--;
    inserts.push({ at, text: attrText(TEXT_KEY_ATTR, key) });
  }
  inserts.sort((a, b) => b.at - a.at);
  let out = html;
  for (const { at, text } of inserts) out = out.slice(0, at) + text + out.slice(at);
  return out;
}
