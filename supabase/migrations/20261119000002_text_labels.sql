-- Text tab, phase T5 (DEVELOPMENT.md §7 "Text tab"): names the user gives to the Text tab's
-- groups and fields, remembered per template (all its variations share them).
-- 1. Table text_labels: one row per renamed group or field, keyed by the engine's structural key.
--    A key the template no longer has is simply not shown; the guessed name is used again when the
--    row is deleted (an empty name in the app).
-- 2. duplicate_template copies the labels with the template (the rest of the function is
--    unchanged from 20261118000006).

create table public.text_labels (
  template_id uuid not null,
  owner_id    uuid not null default auth.uid(),
  kind        text not null check (kind in ('group', 'field')),
  field_key   text not null check (char_length(field_key) between 1 and 1000),
  label       text not null check (char_length(btrim(label)) between 1 and 60 and label = btrim(label)),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (template_id, kind, field_key),
  foreign key (template_id, owner_id) references public.templates (id, owner_id) on delete cascade
);
create trigger text_labels_updated_at before update on public.text_labels
  for each row execute function public.set_updated_at();

-- Nothing for anon (Supabase grants new tables to anon by default); authenticated through RLS.
revoke all on public.text_labels from anon;

alter table public.text_labels enable row level security;
create policy "owner select" on public.text_labels for select to authenticated using (owner_id = (select auth.uid()));
create policy "owner insert" on public.text_labels for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "owner update" on public.text_labels for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "owner delete" on public.text_labels for delete to authenticated using (owner_id = (select auth.uid()));

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

  -- Text tab names (T5) belong to the template, so the copy keeps them.
  insert into public.text_labels (template_id, kind, field_key, label)
  select new_id, kind, field_key, label from public.text_labels where template_id = p_id;

  return new_id;
end;
$$;
