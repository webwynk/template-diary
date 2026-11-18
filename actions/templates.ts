"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import * as templatesDb from "@/lib/db/templates";
import { applySwaps, detect, EngineError, summarize } from "@/lib/engine";
import { checkContent } from "@/lib/templates/content";
import { gunzipUpload } from "@/lib/templates/upload-server";
import { swapListSchema } from "@/lib/validation/swaps";
import { idSchema, saveVariationSchema, templateDetailsSchema } from "@/lib/validation/templates";

export type CreateTemplateResult = { ok: false; error: string };

function field(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === "string" ? value : null;
}

function parseTagIds(raw: string | null): unknown {
  if (raw === null || raw === "") return [];
  try {
    return JSON.parse(raw);
  } catch {
    return null; // fails validation below
  }
}

/**
 * Create a template and its locked Original in one transaction (create_template RPC), then
 * open it. Content arrives gzip-compressed (lib/templates/upload.ts) and is stored unchanged.
 */
export async function createTemplateAction(formData: FormData): Promise<CreateTemplateResult> {
  await getCurrentUser();

  const parsed = templateDetailsSchema.safeParse({
    name: field(formData, "name"),
    type: field(formData, "type"),
    tagIds: parseTagIds(field(formData, "tagIds")),
    notes: field(formData, "notes"),
    usedIn: field(formData, "usedIn"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please check the form and try again.",
    };
  }

  const content = await gunzipUpload(formData.get("content"));
  if (content === null) {
    return {
      ok: false,
      error: "The template content couldn't be read. It may be too large; the limit is 5 MB.",
    };
  }
  const checked = checkContent(content, parsed.data.type);
  if (!checked.ok) return checked;

  // The summary is computed here, never taken from the browser.
  const detected = summarize(detect(content, parsed.data.type));
  const result = await templatesDb.createTemplate(parsed.data, content, detected);
  if (!result.ok) return result;

  redirect(`/templates/${result.data.id}/edit`);
}

export type ContentResult = { ok: true; content: string } | { ok: false; error: string };

/** Exact saved content of a variation, for Copy code. */
export async function getVariationContentAction(id: unknown): Promise<ContentResult> {
  await getCurrentUser();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "That variation doesn't exist." };

  const result = await templatesDb.getVariationContent(parsed.data);
  if (!result.ok) return result;
  if (!result.data) return { ok: false, error: "That variation doesn't exist any more." };
  return { ok: true, content: result.data.content };
}

export type SaveVariationResult =
  { ok: true; id: string } | { ok: false; error: string; field?: "name" };

/**
 * Save the editor's work as a new variation. The browser sends its source (base + manual edits,
 * gzip-compressed) and the pending swaps; the server applies them with lib/engine itself, so the
 * saved content and the changes list can't disagree (RULES.md §6).
 */
export async function saveVariationAction(formData: FormData): Promise<SaveVariationResult> {
  await getCurrentUser();

  const parsed = saveVariationSchema.safeParse({
    templateId: field(formData, "templateId"),
    baseVariationId: field(formData, "baseVariationId"),
    name: field(formData, "name"),
    usedIn: field(formData, "usedIn"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue?.message ?? "Please check the form and try again.",
      ...(issue?.path[0] === "name" ? { field: "name" as const } : {}),
    };
  }

  const swaps = swapListSchema.safeParse(parseJson(field(formData, "swaps")));
  if (!swaps.success)
    return { ok: false, error: swaps.error.issues[0]?.message ?? "Invalid changes." };

  const source = await gunzipUpload(formData.get("source"));
  if (source === null) {
    return {
      ok: false,
      error: "The template content couldn't be read. It may be too large; the limit is 5 MB.",
    };
  }

  const base = await templatesDb.getBaseForSave(
    parsed.data.templateId,
    parsed.data.baseVariationId,
  );
  if (!base.ok) return base;
  if (!base.data) return { ok: false, error: "The variation you started from no longer exists." };
  const type = base.data.type;

  const checked = checkContent(source, type);
  if (!checked.ok) return checked;

  let content: string;
  let applied;
  try {
    ({ content, applied } = applySwaps(source, type, swaps.data));
  } catch (error) {
    if (error instanceof EngineError) return { ok: false, error: error.message };
    throw error;
  }
  const after = checkContent(content, type);
  if (!after.ok) return after;
  if (content === base.data.content)
    return { ok: false, error: "There are no changes to save yet." };

  const codeEdited = source !== base.data.content;
  const result = await templatesDb.insertVariation({
    templateId: parsed.data.templateId,
    parentVariationId: parsed.data.baseVariationId,
    name: parsed.data.name,
    usedIn: parsed.data.usedIn,
    content,
    detected: summarize(detect(content, type)),
    changes: [...applied, ...(codeEdited ? [{ kind: "code" }] : [])],
  });
  if (!result.ok) {
    return result.error === templatesDb.VARIATION_NAME_TAKEN
      ? { ...result, field: "name" }
      : result;
  }
  refresh();
  return { ok: true, id: result.data.id };
}

function parseJson(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
