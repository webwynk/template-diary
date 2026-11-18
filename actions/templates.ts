"use server";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import * as templatesDb from "@/lib/db/templates";
import { detect, summarize } from "@/lib/engine";
import { checkContent } from "@/lib/templates/content";
import { gunzipUpload } from "@/lib/templates/upload-server";
import { idSchema, templateDetailsSchema } from "@/lib/validation/templates";

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

  redirect(`/templates/${result.data.id}`);
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
