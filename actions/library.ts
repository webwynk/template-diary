"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import * as libraryDb from "@/lib/db/library";
import { listTemplates as listTemplatesDb } from "@/lib/db/templates";
import { idSchema, templateDetailsSchema, templateNameSchema } from "@/lib/validation/templates";

export type LibraryActionResult = { ok: true } | { ok: false; error: string };

const NOT_FOUND = "This template no longer exists.";

function done<T>(result: { ok: true; data: T } | { ok: false; error: string }) {
  if (!result.ok) return result;
  refresh();
  return { ok: true as const };
}

export async function setFavoriteAction(id: unknown, value: unknown): Promise<LibraryActionResult> {
  await getCurrentUser();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success || typeof value !== "boolean") return { ok: false, error: NOT_FOUND };
  return done(await libraryDb.setFavorite(parsedId.data, value));
}

export async function trashTemplateAction(id: unknown): Promise<LibraryActionResult> {
  await getCurrentUser();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: NOT_FOUND };
  return done(await libraryDb.trashTemplate(parsedId.data));
}

export async function restoreTemplateAction(id: unknown): Promise<LibraryActionResult> {
  await getCurrentUser();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: NOT_FOUND };
  return done(await libraryDb.restoreTemplate(parsedId.data));
}

/** "Edit details": name, tags, notes, used in. */
export async function updateTemplateDetailsAction(
  id: unknown,
  input: unknown,
): Promise<LibraryActionResult> {
  await getCurrentUser();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: NOT_FOUND };
  const parsed = templateDetailsSchema.omit({ type: true }).safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  return done(await libraryDb.updateTemplateDetails(parsedId.data, parsed.data));
}

export type DuplicateTemplateResult =
  { ok: true; id: string; type: "custom" | "elementor" } | { ok: false; error: string };

export async function duplicateTemplateAction(
  id: unknown,
  name: unknown,
): Promise<DuplicateTemplateResult> {
  await getCurrentUser();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: NOT_FOUND };
  const parsedName = templateNameSchema.safeParse(name);
  if (!parsedName.success) {
    return { ok: false, error: parsedName.error.issues[0]?.message ?? "Enter a name." };
  }
  const result = await libraryDb.duplicateTemplate(parsedId.data, parsedName.data);
  if (!result.ok) return result;
  refresh();
  return { ok: true, ...result.data };
}

const trashTargetSchema = z.object({ kind: z.enum(["template", "variation"]), id: idSchema });

/** Delete one trashed template or variation permanently, with its images. */
export async function deleteForeverAction(target: unknown): Promise<LibraryActionResult> {
  await getCurrentUser();
  const parsed = trashTargetSchema.safeParse(target);
  if (!parsed.success) return { ok: false, error: "This item is no longer in the trash." };
  return done(await libraryDb.deleteForever(parsed.data));
}

export async function emptyTrashAction(): Promise<LibraryActionResult> {
  await getCurrentUser();
  return done(await libraryDb.deleteForever("all"));
}

export type SearchHit = { id: string; name: string; type: "custom" | "elementor" };

/** Ctrl/⌘+K: the first templates matching the query (same search as the library). */
export async function searchTemplatesAction(
  q: unknown,
): Promise<{ ok: true; hits: SearchHit[] } | { ok: false; error: string }> {
  await getCurrentUser();
  const query = typeof q === "string" ? q.trim().slice(0, 200) : "";
  if (!query) return { ok: true, hits: [] };
  const result = await listTemplatesDb({ q: query });
  if (!result.ok) return result;
  return {
    ok: true,
    hits: result.data.slice(0, 8).map((t) => ({ id: t.id, name: t.name, type: t.type })),
  };
}
