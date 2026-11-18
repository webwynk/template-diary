"use server";

import { refresh } from "next/cache";

import { getCurrentUser } from "@/lib/auth";
import * as presetsDb from "@/lib/db/presets";
import type { Preset } from "@/lib/presets";
import { idSchema } from "@/lib/validation/templates";
import { presetInputSchema } from "@/lib/validation/presets";

export type PresetActionResult = { ok: true } | { ok: false; error: string };

const NOT_FOUND = "This palette no longer exists.";

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Please check the form and try again.";
}

/** The user's palettes, for the editor's Apply preset dialog. */
export async function listPresetsAction(): Promise<
  { ok: true; presets: Preset[] } | { ok: false; error: string }
> {
  await getCurrentUser();
  const result = await presetsDb.listPresets();
  if (!result.ok) return result;
  return { ok: true, presets: result.data };
}

export async function createPresetAction(
  input: unknown,
): Promise<{ ok: true; preset: Preset } | { ok: false; error: string }> {
  await getCurrentUser();
  const parsed = presetInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const result = await presetsDb.createPreset(parsed.data);
  if (!result.ok) return result;
  refresh();
  return { ok: true, preset: result.data };
}

export async function updatePresetAction(id: unknown, input: unknown): Promise<PresetActionResult> {
  await getCurrentUser();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: NOT_FOUND };
  const parsed = presetInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const result = await presetsDb.updatePreset(parsedId.data, parsed.data);
  if (!result.ok) return result;
  refresh();
  return { ok: true };
}

/** A copy named "X copy" (or "X copy 2", …) with the same colors. */
export async function duplicatePresetAction(id: unknown): Promise<PresetActionResult> {
  await getCurrentUser();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: NOT_FOUND };
  const source = await presetsDb.getPreset(parsedId.data);
  if (!source.ok) return source;
  if (!source.data) return { ok: false, error: NOT_FOUND };
  const base = source.data.name.slice(0, 50);
  for (let n = 1; n <= 20; n++) {
    const name = n === 1 ? `${base} copy` : `${base} copy ${n}`;
    const result = await presetsDb.createPreset({ name, colors: source.data.colors });
    if (result.ok) {
      refresh();
      return { ok: true };
    }
    if (result.error !== presetsDb.PRESET_NAME_TAKEN) return result;
  }
  return { ok: false, error: "Rename some of the copies first, then try again." };
}

export async function deletePresetAction(id: unknown): Promise<PresetActionResult> {
  await getCurrentUser();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: NOT_FOUND };
  const result = await presetsDb.deletePreset(parsedId.data);
  if (!result.ok) return result;
  refresh();
  return { ok: true };
}

/** Called when a mapping from this palette is applied in the editor ("used N times"). */
export async function countPresetUseAction(id: unknown): Promise<PresetActionResult> {
  await getCurrentUser();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: NOT_FOUND };
  return presetsDb.countPresetUse(parsedId.data).then((r) => (r.ok ? { ok: true } : r));
}
