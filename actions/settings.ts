"use server";

import { refresh } from "next/cache";

import { getCurrentUser } from "@/lib/auth";
import * as settingsDb from "@/lib/db/settings";
import { preferencesSchema } from "@/lib/validation/settings";

export type PreferencesResult = { ok: true } | { ok: false; error: string };

export async function savePreferencesAction(input: unknown): Promise<PreferencesResult> {
  const user = await getCurrentUser();
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose a device and a feature image option." };
  const result = await settingsDb.savePreferences(user.id, parsed.data);
  if (!result.ok) return result;
  refresh();
  return { ok: true };
}
