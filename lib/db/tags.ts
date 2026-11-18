import "server-only";

import { cache } from "react";

import { toUserError, type DbResult } from "@/lib/db/result";
import { createClient } from "@/lib/supabase/server";
import type { TagWithCount } from "@/lib/tags";
import type { CreateTagInput, UpdateTagInput } from "@/lib/validation/tags";

// Postgres unique_violation: tags_owner_name_uq (owner_id, lower(btrim(name))).
const DUPLICATE_NAME = { "23505": "You already have a tag with this name." };

/**
 * All of the user's tags with how many live templates use each, sorted by name. Cached per
 * request (React cache()), so the sidebar and the page share one database call.
 */
export const listTagsWithCounts = cache(async function listTagsWithCounts(): Promise<
  DbResult<TagWithCount[]>
> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_tags_with_counts");
  if (error) return { ok: false, error: toUserError(error, "list_tags_with_counts") };
  return {
    ok: true,
    data: data.map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      templateCount: Number(row.template_count),
    })),
  };
});

export async function createTag(input: CreateTagInput): Promise<DbResult<{ id: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tags")
    .insert({ name: input.name, color: input.color })
    .select("id")
    .single();
  if (error) return { ok: false, error: toUserError(error, "createTag", DUPLICATE_NAME) };
  return { ok: true, data };
}

export async function updateTag(input: UpdateTagInput): Promise<DbResult<null>> {
  const supabase = await createClient();
  const patch: { name?: string; color?: string } = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.color !== undefined) patch.color = input.color;

  const { data, error } = await supabase.from("tags").update(patch).eq("id", input.id).select("id");
  if (error) return { ok: false, error: toUserError(error, "updateTag", DUPLICATE_NAME) };
  // RLS hides other users' rows, so "not found" and "not yours" look the same.
  if (data.length === 0) return { ok: false, error: "That tag no longer exists." };
  return { ok: true, data: null };
}

/** Deletes the tag; its links to templates are removed by the foreign-key cascade. */
export async function deleteTag(id: string): Promise<DbResult<null>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tags").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: toUserError(error, "deleteTag") };
  if (data.length === 0) return { ok: false, error: "That tag no longer exists." };
  return { ok: true, data: null };
}
