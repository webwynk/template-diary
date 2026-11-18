import "server-only";

import { toUserError, type DbResult } from "@/lib/db/result";
import { parsePresetColors, type Preset } from "@/lib/presets";
import { createClient } from "@/lib/supabase/server";
import type { PresetInput } from "@/lib/validation/presets";

// Postgres unique_violation: palette_presets_owner_name_uq (owner_id, lower(btrim(name))).
export const PRESET_NAME_TAKEN = "You already have a palette with this name.";
const ERRORS = { "23505": PRESET_NAME_TAKEN };
const NOT_FOUND = "This palette no longer exists.";

type Row = {
  id: string;
  name: string;
  colors: Parameters<typeof parsePresetColors>[0];
  use_count: number;
  updated_at: string;
};
const COLUMNS = "id, name, colors, use_count, updated_at";

function toPreset(row: Row): Preset {
  return {
    id: row.id,
    name: row.name,
    colors: parsePresetColors(row.colors),
    useCount: row.use_count,
    updatedAt: row.updated_at,
  };
}

/** All of the user's palettes, by name. */
export async function listPresets(): Promise<DbResult<Preset[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("palette_presets")
    .select(COLUMNS)
    .order("name", { ascending: true })
    .order("id", { ascending: true });
  if (error) return { ok: false, error: toUserError(error, "listPresets") };
  // Case-insensitive like the unique index (the database orders by its collation).
  return {
    ok: true,
    data: data
      .map(toPreset)
      .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" })),
  };
}

export async function createPreset(input: PresetInput): Promise<DbResult<Preset>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("palette_presets")
    .insert({ name: input.name, colors: input.colors })
    .select(COLUMNS)
    .single();
  if (error) return { ok: false, error: toUserError(error, "createPreset", ERRORS) };
  return { ok: true, data: toPreset(data) };
}

export async function updatePreset(id: string, input: PresetInput): Promise<DbResult<null>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("palette_presets")
    .update({ name: input.name, colors: input.colors })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: toUserError(error, "updatePreset", ERRORS) };
  // RLS hides other users' rows, so "not found" and "not yours" look the same.
  if (data.length === 0) return { ok: false, error: NOT_FOUND };
  return { ok: true, data: null };
}

export async function getPreset(id: string): Promise<DbResult<Preset | null>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("palette_presets")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, error: toUserError(error, "getPreset") };
  return { ok: true, data: data ? toPreset(data) : null };
}

export async function deletePreset(id: string): Promise<DbResult<null>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("palette_presets").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: toUserError(error, "deletePreset") };
  if (data.length === 0) return { ok: false, error: NOT_FOUND };
  return { ok: true, data: null };
}

/** Counts one use of a palette (atomic in the database). */
export async function countPresetUse(id: string): Promise<DbResult<null>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("use_palette_preset", { p_id: id });
  if (error) return { ok: false, error: toUserError(error, "countPresetUse") };
  if (data === null) return { ok: false, error: NOT_FOUND };
  return { ok: true, data: null };
}
