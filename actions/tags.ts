"use server";

import { refresh } from "next/cache";

import { getCurrentUser } from "@/lib/auth";
import * as tagsDb from "@/lib/db/tags";
import { createTagSchema, deleteTagSchema, updateTagSchema } from "@/lib/validation/tags";

export type ActionResult = { ok: true } | { ok: false; error: string };

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Please check the form and try again.";
}

export async function createTagAction(input: unknown): Promise<ActionResult> {
  await getCurrentUser();
  const parsed = createTagSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const result = await tagsDb.createTag(parsed.data);
  if (!result.ok) return result;
  refresh();
  return { ok: true };
}

export async function updateTagAction(input: unknown): Promise<ActionResult> {
  await getCurrentUser();
  const parsed = updateTagSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const result = await tagsDb.updateTag(parsed.data);
  if (!result.ok) return result;
  refresh();
  return { ok: true };
}

export async function deleteTagAction(input: unknown): Promise<ActionResult> {
  await getCurrentUser();
  const parsed = deleteTagSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const result = await tagsDb.deleteTag(parsed.data.id);
  if (!result.ok) return result;
  refresh();
  return { ok: true };
}
