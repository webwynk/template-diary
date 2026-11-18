-- Library power features (DEVELOPMENT.md Phase 9).
-- 1. Trigram indexes for the search fields that didn't have one yet.
-- 2. search_templates(q): ids of live templates matching q in name, notes, used in,
--    live variation names / used in, or tag names (case-insensitive substring).
-- 3. duplicate_template(id, name): copies a live template, its tags and all live variations.

create index if not exists templates_notes_trgm_idx on public.templates
  using gin (notes extensions.gin_trgm_ops);
create index if not exists templates_used_in_trgm_idx on public.templates
  using gin (used_in extensions.gin_trgm_ops);
create index if not exists variations_used_in_trgm_idx on public.variations
  using gin (used_in extensions.gin_trgm_ops);
create index if not exists tags_name_trgm_idx on public.tags
  using gin (name extensions.gin_trgm_ops);

create or replace function public.search_templates(p_q text)
returns setof uuid
language sql
stable
security invoker
set search_path = ''
as $$
  -- The query is matched literally: \, % and _ are escaped for ILIKE.
  with q as (
    select '%' || replace(replace(replace(btrim(coalesce(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%' as p
  )
  select t.id
  from public.templates t, q
  where t.deleted_at is null
    and (
      t.name ilike q.p
      or t.notes ilike q.p
      or t.used_in ilike q.p
      or exists (
        select 1 from public.variations v
        where v.template_id = t.id and v.deleted_at is null
          and (v.name ilike q.p or v.used_in ilike q.p)
      )
      or exists (
        select 1 from public.template_tags tt
        join public.tags g on g.id = tt.tag_id
        where tt.template_id = t.id and g.name ilike q.p
      )
    );
$$;

create or replace function public.duplicate_template(p_id uuid, p_name text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  src public.templates;
  new_id uuid;
  v record;
  id_map jsonb := '{}'::jsonb;
  new_variation_id uuid;
begin
  select * into src from public.templates where id = p_id and deleted_at is null;
  if not found then
    raise exception 'Template not found' using errcode = 'P0002';
  end if;

  insert into public.templates (name, type, notes, used_in)
  values (btrim(p_name), src.type, src.notes, src.used_in)
  returning id into new_id;

  insert into public.template_tags (template_id, tag_id)
  select new_id, tag_id from public.template_tags where template_id = p_id;

  -- Copy parents before their children (walk the tree from the roots), so each copy can point
  -- at its parent's copy. A parent that is trashed (not copied) leaves the link empty.
  -- created_at alone isn't enough: rows made in one transaction (an earlier copy) share it.
  for v in
    with recursive live as (
      select * from public.variations where template_id = p_id and deleted_at is null
    ), tree as (
      select l.*, 0 as depth from live l
      where l.parent_variation_id is null
         or not exists (select 1 from live p where p.id = l.parent_variation_id)
      union all
      select c.*, tree.depth + 1 from live c join tree on c.parent_variation_id = tree.id
    )
    select * from tree order by depth, is_original desc, created_at, id
  loop
    insert into public.variations
      (template_id, parent_variation_id, name, is_original, content, detected, changes, used_in)
    values
      (new_id, (id_map ->> v.parent_variation_id::text)::uuid, v.name, v.is_original,
       v.content, v.detected, v.changes, v.used_in)
    returning id into new_variation_id;
    id_map := id_map || jsonb_build_object(v.id::text, new_variation_id);
  end loop;

  return new_id;
end;
$$;

revoke execute on function public.search_templates(text) from public, anon;
grant execute on function public.search_templates(text) to authenticated;
revoke execute on function public.duplicate_template(uuid, text) from public, anon;
grant execute on function public.duplicate_template(uuid, text) to authenticated;
