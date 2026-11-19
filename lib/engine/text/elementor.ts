// Text tab for Elementor exports (DEVELOPMENT.md §7 "Text tab", phase T2).
//
// Elementor keeps text in widget settings, so fields come from a map of known widgets (plus a
// careful fallback for add-on widgets). Groups follow the layout: each top-level section or
// container, with sibling columns/containers/widgets that repeat the same structure as cards.
// Edits are written into the original JSON text at their exact token ranges (as palette swaps
// are), and the result must still be a valid export.
import { applyEdits, type Edit } from "@/lib/engine/custom/apply";
import { type ElementorExport, parseElementor } from "@/lib/engine/elementor/detect";
import {
  encodeJsonString,
  type JsonPath,
  locateTokens,
  pathKey,
  type TokenMap,
} from "@/lib/engine/elementor/json-locate";
import { classTokens } from "@/lib/engine/text/icons";
import type { IconKind, TextField, TextGroup, TextModel, TextRole } from "@/lib/engine/text/types";
import {
  type AppliedChange,
  type ApplyResult,
  EngineError,
  type IconAs,
  type TextSwap,
} from "@/lib/engine/types";

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// ---------------------------------------------------------------------------------------------
// Widget map
// ---------------------------------------------------------------------------------------------

type Hint = "heading" | "title" | "text" | "button" | "icon" | "link" | "named";

interface Spec {
  /** Setting key, or "link" for link controls ({ url, … }). Dots for nested keys. */
  key: string;
  hint: Hint;
  /** Fixed label (hint "named"), e.g. "Quote", "Price". */
  label?: string;
  /** Icons and links that belong to another field of the same widget, by its key. */
  owner?: string;
}

interface RepeaterSpec {
  repeater: string;
  item: string;
  fields: { key: string; part: string; kind: "text" | "icon" | "link" }[];
}

const WIDGETS: Record<string, (Spec | RepeaterSpec)[]> = {
  heading: [
    { key: "title", hint: "heading" },
    { key: "link", hint: "link", owner: "title" },
  ],
  "text-editor": [{ key: "editor", hint: "text" }],
  button: [
    { key: "text", hint: "button" },
    { key: "selected_icon", hint: "icon", owner: "text" },
    { key: "link", hint: "link", owner: "text" },
  ],
  "icon-box": [
    { key: "selected_icon", hint: "icon" },
    { key: "title_text", hint: "title" },
    { key: "description_text", hint: "text" },
    { key: "link", hint: "link" },
  ],
  "image-box": [
    { key: "title_text", hint: "title" },
    { key: "description_text", hint: "text" },
    { key: "link", hint: "link" },
  ],
  icon: [
    { key: "selected_icon", hint: "icon" },
    { key: "link", hint: "link", owner: "selected_icon" },
  ],
  "icon-list": [
    {
      repeater: "icon_list",
      item: "Item",
      fields: [
        { key: "text", part: "", kind: "text" },
        { key: "selected_icon", part: "icon", kind: "icon" },
        { key: "link", part: "link", kind: "link" },
      ],
    },
  ],
  testimonial: [
    { key: "testimonial_content", hint: "named", label: "Quote" },
    { key: "testimonial_name", hint: "named", label: "Name" },
    { key: "testimonial_job", hint: "named", label: "Job title" },
  ],
  counter: [
    { key: "prefix", hint: "named", label: "Prefix" },
    { key: "suffix", hint: "named", label: "Suffix" },
    { key: "title", hint: "title" },
  ],
  "call-to-action": [
    { key: "ribbon_title", hint: "named", label: "Ribbon" },
    { key: "title", hint: "title" },
    { key: "description", hint: "text" },
    { key: "button", hint: "button" },
    { key: "link", hint: "link", owner: "button" },
  ],
  "price-table": [
    { key: "heading", hint: "title" },
    { key: "sub_heading", hint: "named", label: "Subtitle" },
    { key: "price", hint: "named", label: "Price" },
    { key: "period", hint: "named", label: "Period" },
    {
      repeater: "features_list",
      item: "Feature",
      fields: [
        { key: "item_text", part: "", kind: "text" },
        { key: "selected_item_icon", part: "icon", kind: "icon" },
      ],
    },
    { key: "button_text", hint: "button" },
    { key: "link", hint: "link", owner: "button_text" },
    { key: "footer_additional_info", hint: "named", label: "Footer text" },
    { key: "ribbon_title", hint: "named", label: "Ribbon" },
  ],
  accordion: [tabs()],
  toggle: [tabs()],
  tabs: [tabs()],
  alert: [
    { key: "alert_title", hint: "title" },
    { key: "alert_description", hint: "text" },
  ],
  progress: [
    { key: "title", hint: "title" },
    { key: "inner_text", hint: "named", label: "Inner text" },
  ],
  "star-rating": [{ key: "title", hint: "title" }],
  blockquote: [
    { key: "blockquote_content", hint: "named", label: "Quote" },
    { key: "author_name", hint: "named", label: "Author" },
  ],
  "flip-box": [
    { key: "selected_icon", hint: "icon" },
    { key: "title_text_a", hint: "named", label: "Front title" },
    { key: "description_text_a", hint: "named", label: "Front text" },
    { key: "title_text_b", hint: "named", label: "Back title" },
    { key: "description_text_b", hint: "named", label: "Back text" },
    { key: "button_text", hint: "button" },
    { key: "link", hint: "link", owner: "button_text" },
  ],
  "animated-headline": [
    { key: "before_text", hint: "named", label: "Before text" },
    { key: "highlighted_text", hint: "named", label: "Highlighted text" },
    { key: "rotating_text", hint: "named", label: "Rotating text" },
    { key: "after_text", hint: "named", label: "After text" },
  ],
  "social-icons": [
    {
      repeater: "social_icon_list",
      item: "Icon",
      fields: [
        { key: "social_icon", part: "", kind: "icon" },
        { key: "link", part: "link", kind: "link" },
      ],
    },
  ],
  slides: [
    {
      repeater: "slides",
      item: "Slide",
      fields: [
        { key: "heading", part: "heading", kind: "text" },
        { key: "description", part: "text", kind: "text" },
        { key: "button_text", part: "button", kind: "text" },
        { key: "link", part: "link", kind: "link" },
      ],
    },
  ],
  divider: [{ key: "text", hint: "named", label: "Divider text" }],
  image: [
    { key: "caption", hint: "named", label: "Caption" },
    { key: "link", hint: "link" },
  ],
  form: [{ key: "button_text", hint: "button" }],
};

function tabs(): RepeaterSpec {
  return {
    repeater: "tabs",
    item: "Tab",
    fields: [
      { key: "tab_title", part: "title", kind: "text" },
      { key: "tab_content", part: "content", kind: "text" },
    ],
  };
}

/** Code and layout widgets: never read. */
const SKIP_WIDGETS = new Set([
  "html",
  "shortcode",
  "nav-menu",
  "menu-anchor",
  "spacer",
  "google_maps",
  "video",
  "audio",
  "sidebar",
  "template",
]);

/** Add-on widgets: text-like setting keys only. */
const FALLBACK_KEY_RE =
  /^(?:title|heading|sub_?heading|subtitle|description|content|text|label|caption|button_text|btn_text)$|_(?:title|text|heading|subtitle|description|content|label)$/;
const NOT_TEXT_KEY_RE =
  /color|typography|font|css|class|_id$|^id$|size|width|height|align|url|link|html|icon|image|animation|position/i;
const NOT_TEXT_VALUE_RE =
  /^(?:#[0-9a-f]{3,8}|https?:\/\/\S+|-?\d+(?:\.\d+)?(?:px|em|rem|%)?|yes|no|on|off)$/i;

// ---------------------------------------------------------------------------------------------
// Raw fields
// ---------------------------------------------------------------------------------------------

interface RawField {
  key: string;
  type: TextField["type"];
  value: string;
  /** Path of the string token (text/link) or of the icon object/string. */
  path: JsonPath;
  hint: Hint;
  label?: string;
  /** Key of the field this icon/link belongs to (same widget). */
  ownerKey?: string;
  /** Heading size 1–6 for heading widgets. */
  level?: number;
  /** Element ids from the top-level element down to the widget. */
  chain: Obj[];
  item?: { label: string; index: number; part: string; repeaterKey: string };
  iconKind?: IconKind;
  iconValue?: string;
  /** Legacy string icon setting ("fa fa-star"). */
  legacyIcon?: boolean;
}

interface Ctx {
  fields: RawField[];
  dynamic: number;
}

function elementKey(el: Obj, path: JsonPath): string {
  return typeof el.id === "string" && el.id ? el.id : pathKey(path);
}

function textType(value: string): "text" | "html" {
  return /<[a-z!/]|&(?:[a-z]+|#\d+|#x[0-9a-f]+);/i.test(value) ? "html" : "text";
}

/** Icon setting → field value, kind and what to show. Null when it isn't an icon value. */
function readIcon(
  v: unknown,
): { value: string; kind: IconKind; shown: string; legacy?: boolean } | null {
  if (typeof v === "string")
    return v.trim() ? { value: v, kind: "font", shown: v, legacy: true } : null;
  if (!isObj(v)) return null;
  const library = typeof v.library === "string" ? v.library : "";
  if (typeof v.value === "string") {
    return { value: `${library}:${v.value}`, kind: "font", shown: v.value };
  }
  if (isObj(v.value) && typeof v.value.url === "string") {
    return { value: `${library}:${v.value.url}`, kind: "image", shown: v.value.url };
  }
  return null;
}

function get(settings: Obj, key: string): unknown {
  return settings[key];
}

function addSetting(
  ctx: Ctx,
  settings: Obj,
  base: JsonPath,
  widgetKey: string,
  chain: Obj[],
  key: string,
  kind: "text" | "icon" | "link",
  extra: Partial<RawField>,
  dynamic: Obj | null,
  settingPrefix: string,
): void {
  if (dynamic && key in dynamic) {
    ctx.dynamic++;
    return;
  }
  const value = get(settings, key);
  const fieldKey = `${widgetKey}|${settingPrefix}${key}`;
  if (kind === "link") {
    if (!isObj(value) || typeof value.url !== "string") return;
    ctx.fields.push({
      key: `${fieldKey}.url`,
      type: "link",
      value: value.url,
      path: [...base, key, "url"],
      hint: "link",
      chain,
      ...extra,
    });
    return;
  }
  if (kind === "icon") {
    const icon = readIcon(value);
    if (!icon) return;
    ctx.fields.push({
      key: fieldKey,
      type: "icon",
      value: icon.value,
      path: [...base, key],
      hint: "icon",
      chain,
      iconKind: icon.kind,
      iconValue: icon.shown,
      ...(icon.legacy ? { legacyIcon: true } : {}),
      ...extra,
    });
    return;
  }
  if (typeof value !== "string" || value.trim() === "") return;
  ctx.fields.push({
    key: fieldKey,
    type: textType(value),
    value,
    path: [...base, key],
    hint: "text",
    chain,
    ...extra,
  });
}

function walkWidget(ctx: Ctx, el: Obj, path: JsonPath, chain: Obj[]): void {
  const widget = typeof el.widgetType === "string" ? el.widgetType : "";
  if (!isObj(el.settings) || SKIP_WIDGETS.has(widget)) return;
  const settings = el.settings;
  const base: JsonPath = [...path, "settings"];
  const widgetKey = elementKey(el, path);
  const dynamic = isObj(settings.__dynamic__) ? settings.__dynamic__ : null;
  const specs = WIDGETS[widget];

  if (!specs) {
    // Add-on widgets: only clearly text-like keys with text-like values.
    for (const [key, value] of Object.entries(settings)) {
      if (typeof value !== "string" || !FALLBACK_KEY_RE.test(key) || NOT_TEXT_KEY_RE.test(key))
        continue;
      if (NOT_TEXT_VALUE_RE.test(value.trim())) continue;
      addSetting(
        ctx,
        settings,
        base,
        widgetKey,
        chain,
        key,
        "text",
        { hint: "named", label: humanizeKey(key) },
        dynamic,
        "",
      );
    }
    return;
  }

  for (const spec of specs) {
    if ("repeater" in spec) {
      const list = settings[spec.repeater];
      if (!Array.isArray(list)) continue;
      list.forEach((row, index) => {
        if (!isObj(row)) return;
        for (const f of spec.fields) {
          addSetting(
            ctx,
            row,
            [...base, spec.repeater, index],
            widgetKey,
            chain,
            f.key,
            f.kind,
            {
              hint: f.kind === "text" ? "text" : f.kind,
              item: {
                label: spec.item,
                index: index + 1,
                part: f.part,
                repeaterKey: `${widgetKey}|${spec.repeater}`,
              },
            },
            null,
            `${spec.repeater}.${index}.`,
          );
        }
      });
      continue;
    }
    const kind = spec.hint === "icon" ? "icon" : spec.hint === "link" ? "link" : "text";
    const extra: Partial<RawField> = { hint: spec.hint };
    if (spec.label) extra.label = spec.label;
    if (spec.owner) extra.ownerKey = `${widgetKey}|${spec.owner}`;
    if (spec.hint === "heading") {
      const size =
        typeof settings.header_size === "string"
          ? /^h([1-6])$/.exec(settings.header_size)?.[1]
          : undefined;
      extra.level = size ? Number(size) : 2;
    }
    addSetting(ctx, settings, base, widgetKey, chain, spec.key, kind, extra, dynamic, "");
  }
}

function walkElement(ctx: Ctx, el: unknown, path: JsonPath, chain: Obj[]): void {
  if (!isObj(el)) return;
  const here = [...chain, el];
  if (el.elType === "widget") walkWidget(ctx, el, path, here);
  if (Array.isArray(el.elements))
    el.elements.forEach((child, i) => walkElement(ctx, child, [...path, "elements", i], here));
}

function humanizeKey(key: string): string {
  const words = key.replace(/_/g, " ").trim();
  return words ? words[0]!.toUpperCase() + words.slice(1) : key;
}

function detectRaw(data: ElementorExport): { fields: RawField[]; warnings: string[] } {
  const ctx: Ctx = { fields: [], dynamic: 0 };
  data.content.forEach((el, i) => walkElement(ctx, el, ["content", i], []));
  const warnings: string[] = [];
  if (ctx.dynamic > 0) {
    warnings.push(
      `${ctx.dynamic} text${ctx.dynamic === 1 ? " comes" : "s come"} from Elementor dynamic tags (site data), so ${ctx.dynamic === 1 ? "it isn't" : "they aren't"} listed here.`,
    );
  }
  return { fields: ctx.fields, warnings };
}

// ---------------------------------------------------------------------------------------------
// Grouping and labels
// ---------------------------------------------------------------------------------------------

function widgetsIn(el: Obj): string[] {
  if (el.elType === "widget") return [String(el.widgetType ?? "")];
  return Array.isArray(el.elements)
    ? el.elements.flatMap((c) => (isObj(c) ? widgetsIn(c) : []))
    : [];
}

function humanizeWidget(type: string): string {
  return humanizeKey(type.replace(/-/g, " "));
}

interface Member {
  index: number;
  label: string;
}

/** Sibling elements with the same structure, each holding two or more texts, are cards. */
function findCards(fields: RawField[], roots: unknown[]): Map<Obj, Member> {
  const counts = new Map<Obj, number>();
  for (const f of fields) {
    if (f.type === "link" || f.type === "icon" || f.item) continue;
    for (const el of f.chain) counts.set(el, (counts.get(el) ?? 0) + 1);
  }
  const cards = new Map<Obj, Member>();
  const visit = (siblings: unknown[]) => {
    const bySig = new Map<string, Obj[]>();
    for (const s of siblings) {
      if (!isObj(s) || (counts.get(s) ?? 0) < 2) continue;
      const sig = `${String(s.elType)}:${widgetsIn(s).join(",")}`;
      bySig.set(sig, [...(bySig.get(sig) ?? []), s]);
    }
    for (const items of bySig.values()) {
      if (items.length < 2) continue;
      const widgets = widgetsIn(items[0]!);
      const label = widgets.length === 1 ? humanizeWidget(widgets[0]!) : "Card";
      items.forEach((el, i) => cards.set(el, { index: i + 1, label }));
    }
    for (const s of siblings) {
      if (isObj(s) && !cards.has(s) && Array.isArray(s.elements)) visit(s.elements);
    }
  };
  for (const root of roots) if (isObj(root) && Array.isArray(root.elements)) visit(root.elements);
  return cards;
}

interface Draft {
  key: string;
  section: Obj | null;
  card?: Member;
  fields: RawField[];
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

function labelFields(draft: Draft): TextField[] {
  const isCard = Boolean(draft.card);
  const roles = new Map<RawField, TextRole>();
  const labels = new Map<RawField, string>();
  const list = draft.fields;
  const plain = list.filter(
    (f) => !f.item && !f.ownerKey && (f.type === "text" || f.type === "html"),
  );

  // Title: the biggest heading (or a title-like setting); eyebrow: a small heading right before it.
  let title: RawField | undefined;
  let best = 7;
  for (const f of plain) {
    if (f.hint === "heading" && (f.level ?? 2) < best) {
      best = f.level ?? 2;
      title = f;
    }
  }
  if (!title) title = plain.find((f) => f.hint === "title");
  if (title) {
    roles.set(title, "title");
    const at = plain.indexOf(title);
    const before = plain[at - 1];
    if (
      before &&
      before.hint === "heading" &&
      (before.level ?? 2) > best &&
      before.value.length <= 60
    ) {
      roles.set(before, "eyebrow");
    }
    if (!isCard) {
      const after = plain.slice(at + 1).find((f) => f.hint === "text");
      if (after) roles.set(after, "subheading");
    }
  }

  for (const f of list) {
    if (roles.has(f)) continue;
    if (f.item) roles.set(f, "item");
    else if (f.type === "icon") roles.set(f, "icon");
    else if (f.type === "link") roles.set(f, "link");
    else if (f.hint === "button") roles.set(f, "button");
    else if (f.hint === "heading") roles.set(f, "heading");
    else if (f.hint === "title")
      roles.set(f, plain.some((p) => roles.get(p) === "title") ? "heading" : "title");
    else roles.set(f, "text");
  }

  const owned = (f: RawField) => (f.ownerKey ? list.find((o) => o.key === f.ownerKey) : undefined);
  for (const f of list) {
    if (f.item) {
      const base = `${f.item.label} ${f.item.index}`;
      labels.set(f, f.item.part ? `${base} ${f.item.part}` : base);
    } else if (!owned(f)) {
      labels.set(f, f.label ?? ROLE_LABEL[roles.get(f)!]);
    }
  }
  numberDuplicates(
    list.filter((f) => !f.item && !owned(f)),
    labels,
  );
  for (const f of list) {
    const owner = owned(f);
    if (!owner) continue;
    labels.set(f, `${labels.get(owner)} ${f.type === "icon" ? "icon" : "link"}`);
  }
  numberDuplicates(
    list.filter((f) => !f.item && owned(f)),
    labels,
  );

  // Owner first, then its icon and link.
  const ordered: RawField[] = [];
  for (const f of list) {
    if (owned(f)) continue;
    ordered.push(f);
    for (const kind of ["icon", "link"] as const) {
      for (const g of list) if (g.type === kind && owned(g) === f) ordered.push(g);
    }
  }
  return ordered.map((f) => ({
    key: f.key,
    role: roles.get(f)!,
    label: labels.get(f)!,
    type: f.type,
    value: f.value,
    ...(f.iconKind ? { iconKind: f.iconKind } : {}),
    ...(f.iconValue !== undefined ? { iconValue: f.iconValue } : {}),
    location: { kind: "path" as const, path: f.path },
  }));
}

function numberDuplicates(list: RawField[], labels: Map<RawField, string>): void {
  const total = new Map<string, number>();
  for (const f of list) total.set(labels.get(f)!, (total.get(labels.get(f)!) ?? 0) + 1);
  const seen = new Map<string, number>();
  for (const f of list) {
    const label = labels.get(f)!;
    if (total.get(label)! < 2) continue;
    const n = (seen.get(label) ?? 0) + 1;
    seen.set(label, n);
    labels.set(f, `${label} ${n}`);
  }
}

function sectionName(el: Obj | null): string | null {
  if (!el || !isObj(el.settings)) return null;
  const title = el.settings._title;
  if (typeof title === "string" && title.trim()) return title.trim().slice(0, 40);
  const id = el.settings._element_id;
  if (typeof id === "string" && /^[a-z][a-z0-9_-]*$/i.test(id))
    return humanizeKey(id.replace(/-/g, " "));
  return null;
}

export function detectTextElementor(
  json: string,
  data: ElementorExport = parseElementor(json),
): TextModel {
  const { fields, warnings } = detectRaw(data);
  const cards = findCards(fields, data.content);
  const drafts: Draft[] = [];
  const byKey = new Map<string, Draft>();
  const runs = new Map<Obj | null, number>();
  let current: Draft | null = null;

  for (const f of fields) {
    const section = f.chain[0] ?? null;
    const cardEl = f.chain.find((el) => cards.has(el));
    if (cardEl) {
      const key = elementKey(cardEl, []);
      let draft = byKey.get(key);
      if (!draft) {
        draft = { key, section, card: cards.get(cardEl)!, fields: [] };
        byKey.set(key, draft);
        drafts.push(draft);
      }
      draft.fields.push(f);
      current = null;
      continue;
    }
    if (!current || current.section !== section) {
      const n: number = (runs.get(section) ?? 0) + 1;
      runs.set(section, n);
      current = { key: `${section ? elementKey(section, []) : ""}~${n}`, section, fields: [] };
      drafts.push(current);
    }
    current.fields.push(f);
  }

  const sections: (Obj | null)[] = [];
  for (const d of drafts) if (!sections.includes(d.section)) sections.push(d.section);
  const names = new Map<Obj | null, string>();
  // Unnamed sections are numbered by their position in the export.
  for (const s of sections) {
    const position = s ? data.content.indexOf(s) + 1 : 0;
    names.set(s, sectionName(s) ?? `Section ${position}`);
  }
  const multi = sections.length > 1;

  const groups: TextGroup[] = [];
  const contentRuns = new Map<Obj | null, number>();
  for (const d of drafts) {
    const out = labelFields(d);
    let label: string;
    let kind: TextGroup["kind"];
    if (d.card) {
      label = `${d.card.label} ${d.card.index}`;
      kind = "card";
    } else if (out.some((f) => f.role === "title")) {
      label = "Heading";
      kind = "heading";
    } else {
      const n = (contentRuns.get(d.section) ?? 0) + 1;
      contentRuns.set(d.section, n);
      label = n === 1 ? "Content" : `Content ${n}`;
      kind = "content";
    }
    if (multi) label = `${names.get(d.section)} · ${label}`;
    groups.push({ key: d.key, kind, label, fields: out });
  }
  const total = new Map<string, number>();
  for (const g of groups) total.set(g.label, (total.get(g.label) ?? 0) + 1);
  const seen = new Map<string, number>();
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

const STALE = "The text changed while applying your edits. Nothing was changed.";

/** Font Awesome classes → Elementor's value and library ("fa-solid fa-star" → "fas fa-star"). */
export function elementorFontIcon(classes: string): { value: string; library: string } {
  const tokens = classTokens(classes);
  const style = tokens
    .find((t) => /^(fas|far|fab|fa-solid|fa-regular|fa-brands)$/i.test(t))
    ?.toLowerCase();
  const icon = tokens.find(
    (t) => /^fa-[a-z0-9-]+$/i.test(t) && !/^fa-(solid|regular|brands)$/i.test(t),
  );
  if (style && icon) {
    const short =
      style === "fa-solid"
        ? "fas"
        : style === "fa-regular"
          ? "far"
          : style === "fa-brands"
            ? "fab"
            : style;
    const library = short === "fas" ? "fa-solid" : short === "far" ? "fa-regular" : "fa-brands";
    const rest = tokens.filter((t) => t !== icon && t.toLowerCase() !== style);
    return { value: [short, icon, ...rest].join(" "), library };
  }
  const eicon = tokens.find((t) => /^eicon-[a-z0-9-]+$/i.test(t));
  if (eicon) return { value: tokens.join(" "), library: "eicons" };
  throw new EngineError(
    "Elementor icons can be Font Awesome classes (for example fas fa-star) or an SVG link.",
  );
}

function shorten(text: string): string {
  return text.length > 200 ? `${text.slice(0, 199)}…` : text;
}

function token(tokens: TokenMap, path: JsonPath) {
  const t = tokens.get(pathKey(path));
  if (!t) throw new EngineError("A value in the export couldn't be located. Nothing was changed.");
  return t;
}

export function applyTextElementor(json: string, swaps: TextSwap[]): ApplyResult {
  if (swaps.length === 0) return { content: json, applied: [] };
  const data = parseElementor(json);
  const { fields } = detectRaw(data);
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const tokens = locateTokens(json);
  const edits: Edit[] = [];
  const applied: AppliedChange[] = [];

  const replaceString = (path: JsonPath, expected: string, next: string) => {
    const t = token(tokens, path);
    const raw = json.slice(t.start, t.end);
    if (JSON.parse(raw) !== expected) throw new EngineError(STALE);
    edits.push({ ...t, raw, text: encodeJsonString(next, raw) });
  };

  for (const swap of swaps) {
    const f = byKey.get(swap.key);
    if (!f)
      throw new EngineError(
        "A text field you edited is no longer in the export. Nothing was changed.",
      );
    if (f.value !== swap.from) throw new EngineError(STALE);
    const before = edits.length;
    if (swap.kind === "text") {
      if (f.type !== "text" && f.type !== "html") throw new EngineError(STALE);
      if (swap.to !== f.value) replaceString(f.path, f.value, swap.to);
    } else if (swap.kind === "link") {
      if (f.type !== "link") throw new EngineError(STALE);
      if (swap.to.trim() !== f.value) replaceString(f.path, f.value, swap.to.trim());
    } else {
      if (f.type !== "icon") throw new EngineError(STALE);
      const next = iconJson(
        f,
        swap.as,
        swap.to.trim(),
        json.slice(token(tokens, f.path).start, token(tokens, f.path).end),
      );
      if (next !== null) {
        const t = token(tokens, f.path);
        edits.push({ ...t, raw: json.slice(t.start, t.end), text: next });
      }
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
  const content = applyEdits(json, edits);
  parseElementor(content); // still a valid export of the same shape
  return { content, applied };
}

/** The new JSON text for an icon setting, or null when nothing changes. */
function iconJson(f: RawField, as: IconAs, to: string, raw: string): string | null {
  const str = (v: string) => encodeJsonString(v, raw);
  if (as === "class") {
    const icon = elementorFontIcon(to);
    if (f.legacyIcon) return icon.value === f.value ? null : str(icon.value);
    if (`${icon.library}:${icon.value}` === f.value) return null;
    return `{${str("value")}:${str(icon.value)},${str("library")}:${str(icon.library)}}`;
  }
  if (as === "image") {
    if (f.legacyIcon)
      throw new EngineError("This older icon setting only takes Font Awesome classes.");
    if (`svg:${to}` === f.value) return null;
    // Elementor downloads the SVG from the link on import; the old media id belongs to another site.
    return `{${str("value")}:{${str("url")}:${str(to)},${str("id")}:""},${str("library")}:${str("svg")}}`;
  }
  throw new EngineError("Elementor icons can be Font Awesome classes or an SVG link.");
}
