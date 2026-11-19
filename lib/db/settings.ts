import "server-only";

import { cache } from "react";

import { toUserError, type DbResult } from "@/lib/db/result";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_PREFERENCES,
  preferencesSchema,
  type Preferences,
} from "@/lib/validation/settings";

// user_settings (DEVELOPMENT.md §5.2): one row per user, created at sign-in. A missing row
// means the defaults; saving creates it.

/** The user's preferences, or the defaults. Cached per request. */
export const getPreferences = cache(async function getPreferences(): Promise<
  DbResult<Preferences>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_settings")
    .select("default_device, default_feature_mode")
    .maybeSingle();
  if (error) return { ok: false, error: toUserError(error, "getPreferences") };
  if (!data) return { ok: true, data: DEFAULT_PREFERENCES };
  const parsed = preferencesSchema.safeParse({
    defaultDevice: data.default_device,
    defaultFeatureMode: data.default_feature_mode,
  });
  return { ok: true, data: parsed.success ? parsed.data : DEFAULT_PREFERENCES };
});

export async function savePreferences(
  ownerId: string,
  prefs: Preferences,
): Promise<DbResult<null>> {
  const supabase = await createClient();
  const { error } = await supabase.from("user_settings").upsert(
    {
      owner_id: ownerId,
      default_device: prefs.defaultDevice,
      default_feature_mode: prefs.defaultFeatureMode,
    },
    { onConflict: "owner_id" },
  );
  if (error) return { ok: false, error: toUserError(error, "savePreferences") };
  return { ok: true, data: null };
}
