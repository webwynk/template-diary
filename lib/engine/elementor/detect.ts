// Detection for Elementor exports (a section/page .json). DEVELOPMENT.md §6.3.
import { z } from "zod";

import { parseColor } from "@/lib/engine/colors";
import { groupColors } from "@/lib/engine/group";
import { type JsonPath, pathKey } from "@/lib/engine/elementor/json-locate";
import { GENERIC_FAMILIES } from "@/lib/engine/fonts";
import {
  type ColorOccurrence,
  type Detection,
  EngineError,
  type FontOccurrence,
  type ImageOccurrence,
} from "@/lib/engine/types";

const exportSchema = z.looseObject({
  content: z.array(z.unknown()),
  version: z.string().optional(),
  title: z.string().optional(),
  type: z.string().optional(),
  page_settings: z.unknown().optional(),
});

export type ElementorExport = z.infer<typeof exportSchema>;

/** Parse and shape-check an export. Throws EngineError with a user-facing message. */
export function parseElementor(json: string): ElementorExport {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new EngineError("This file isn't valid JSON.");
  }
  const result = exportSchema.safeParse(data);
  if (!result.success) {
    throw new EngineError(
      'This doesn\'t look like an Elementor export. Export a section or page from Elementor ("Save as template", then Export) and upload that .json file.',
    );
  }
  return result.data;
}

/** "color", "title_color", "background_color_b" (second gradient color), … */
const COLOR_KEY_RE = /(^|_)color(_b)?$/;
const FONT_KEY_RE = /_font_family$/;

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Elementor image controls: { url, id, … }. Link controls also have url but carry is_external. */
function isImage(v: Obj): v is Obj & { url: string } {
  return typeof v.url === "string" && v.url !== "" && "id" in v && !("is_external" in v);
}

interface Ctx {
  colors: ColorOccurrence[];
  images: ImageOccurrence[];
  fonts: FontOccurrence[];
  globals: number;
  warnings: string[];
}

export function detectElementor(
  json: string,
  data: ElementorExport = parseElementor(json),
): Detection {
  const ctx: Ctx = { colors: [], images: [], fonts: [], globals: 0, warnings: [] };

  if (isObj(data.page_settings))
    walkSettings(data.page_settings, ["page_settings"], "Page settings", ctx);
  data.content.forEach((el, i) => walkElement(el, ["content", i], ctx));

  if (ctx.globals > 0) {
    ctx.warnings.push(
      `${ctx.globals} setting${ctx.globals === 1 ? " uses" : "s use"} site global colors or fonts from Elementor's Site Settings, so ${ctx.globals === 1 ? "it can't" : "they can't"} be swapped here.`,
    );
  }

  return {
    colors: groupColors(ctx.colors),
    images: ctx.images,
    fonts: ctx.fonts,
    warnings: ctx.warnings,
  };
}

function walkElement(el: unknown, path: JsonPath, ctx: Ctx): void {
  if (!isObj(el)) return;
  const label =
    typeof el.widgetType === "string"
      ? el.widgetType
      : typeof el.elType === "string"
        ? el.elType
        : "element";
  // PHP exports empty settings as [], so only objects are read.
  if (isObj(el.settings)) walkSettings(el.settings, [...path, "settings"], label, ctx);
  if (Array.isArray(el.elements))
    el.elements.forEach((child, i) => walkElement(child, [...path, "elements", i], ctx));
}

function walkSettings(obj: Obj, path: JsonPath, label: string, ctx: Ctx): void {
  if (isImage(obj)) {
    const url = obj.url;
    const warning = /^data:/i.test(url)
      ? ("data-uri" as const)
      : /^https?:\/\//i.test(url)
        ? undefined
        : ("relative" as const);
    ctx.images.push({
      id: `image:${pathKey(path)}`,
      url,
      kind: "elementor",
      location: { kind: "path", path },
      ...(warning ? { warning } : {}),
      snippet: `${label} › ${describe(path)}`,
    });
    return;
  }

  for (const [key, value] of Object.entries(obj)) {
    const here = [...path, key];
    if (key === "__globals__") {
      if (isObj(value))
        ctx.globals += Object.values(value).filter((v) => typeof v === "string" && v !== "").length;
      continue;
    }
    if (typeof value === "string") {
      if (COLOR_KEY_RE.test(key)) addColor(ctx, value, here, label);
      else if (FONT_KEY_RE.test(key)) addFont(ctx, value, here, label);
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (isObj(item)) walkSettings(item, [...here, i], label, ctx);
      });
    } else if (isObj(value)) {
      walkSettings(value, here, label, ctx);
    }
  }
}

/** Human description of a settings path, e.g. "slides 2 › background_color". */
function describe(path: JsonPath): string {
  const idx = path.lastIndexOf("settings");
  const rest = idx === -1 ? path.slice(1) : path.slice(idx + 1);
  return rest.map((p) => (typeof p === "number" ? String(p + 1) : p)).join(" › ") || "settings";
}

function addColor(ctx: Ctx, value: string, path: JsonPath, label: string): void {
  const parsed = parseColor(value);
  if (!parsed) return;
  ctx.colors.push({
    id: `color:${pathKey(path)}`,
    raw: value,
    format: parsed.format,
    rgb: parsed.rgb,
    alpha: parsed.alpha,
    location: { kind: "path", path },
    context: "elementor-setting",
    snippet: `${label} › ${describe(path)}`,
  });
}

function addFont(ctx: Ctx, value: string, path: JsonPath, label: string): void {
  const family = value.trim();
  if (!family || GENERIC_FAMILIES.has(family.toLowerCase())) return;
  ctx.fonts.push({
    id: `font:${pathKey(path)}`,
    family,
    raw: value,
    kind: "elementor-typography",
    location: { kind: "path", path },
    snippet: `${label} › ${describe(path)}`,
  });
}
