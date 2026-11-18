"use server";

import { refresh } from "next/cache";

import { getCurrentUser } from "@/lib/auth";
import { createTemplate } from "@/lib/db/templates";
import * as variationsDb from "@/lib/db/variations";
import type { DetectionSummary } from "@/lib/engine";
import { idSchema, templateDetailsSchema, variationNameSchema } from "@/lib/validation/templates";
import { z } from "zod";

export type VariationActionResult = { ok: true } | { ok: false; error: string };

const usedInSchema = z
  .string()
  .trim()
  .max(2000, { message: "“Used in” can be at most 2000 characters." })
  .transform((v) => (v === "" ? null : v));

function badId(): VariationActionResult {
  return { ok: false, error: "This variation no longer exists." };
}

/** Rename a variation (never the Original; DEVELOPMENT.md Phase 7). */
export async function renameVariationAction(
  id: unknown,
  name: unknown,
): Promise<VariationActionResult> {
  await getCurrentUser();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return badId();
  const parsedName = variationNameSchema.safeParse(name);
  if (!parsedName.success) {
    return { ok: false, error: parsedName.error.issues[0]?.message ?? "Enter a name." };
  }
  const result = await variationsDb.renameVariation(parsedId.data, parsedName.data);
  if (!result.ok) return result;
  refresh();
  return { ok: true };
}

/** Edit the "used in" note of a variation. */
export async function setVariationUsedInAction(
  id: unknown,
  usedIn: unknown,
): Promise<VariationActionResult> {
  await getCurrentUser();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return badId();
  const parsed = usedInSchema.safeParse(usedIn ?? "");
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Too long." };
  const result = await variationsDb.setVariationUsedIn(parsedId.data, parsed.data);
  if (!result.ok) return result;
  refresh();
  return { ok: true };
}

/** Move a variation to the trash (never the Original). */
export async function trashVariationAction(id: unknown): Promise<VariationActionResult> {
  await getCurrentUser();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return badId();
  const result = await variationsDb.trashVariation(parsedId.data);
  if (!result.ok) return result;
  refresh();
  return { ok: true };
}

/** Restore a trashed variation. */
export async function restoreVariationAction(id: unknown): Promise<VariationActionResult> {
  await getCurrentUser();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return badId();
  const result = await variationsDb.restoreVariation(parsedId.data);
  if (!result.ok) return result;
  refresh();
  return { ok: true };
}

export type DuplicateResult =
  { ok: true; id: string; type: "custom" | "elementor" } | { ok: false; error: string };

/**
 * "Duplicate as new template": a new template whose Original is this variation's exact code,
 * with the source template's tags and notes. Feature images are not copied (the form makes one).
 */
export async function duplicateAsTemplateAction(
  id: unknown,
  name: unknown,
): Promise<DuplicateResult> {
  await getCurrentUser();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: "This variation no longer exists." };
  const source = await variationsDb.getDuplicateSource(parsedId.data);
  if (!source.ok) return source;
  if (!source.data) return { ok: false, error: "This variation no longer exists." };

  const details = templateDetailsSchema.safeParse({
    name,
    type: source.data.type,
    tagIds: source.data.tagIds,
    notes: source.data.notes ?? "",
    usedIn: "",
  });
  if (!details.success) {
    return {
      ok: false,
      error: details.error.issues[0]?.message ?? "Check the name and try again.",
    };
  }
  // The stored summary was computed by the server when the variation was saved.
  const result = await createTemplate(
    details.data,
    source.data.content,
    source.data.detected as unknown as DetectionSummary,
  );
  if (!result.ok) return result;
  refresh();
  return { ok: true, id: result.data.id, type: source.data.type };
}
