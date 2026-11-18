-- Hasan's decision (2026-11-18): a saved variation's code can be edited and saved in place.
-- Only the Original stays locked: its content, name and trash state never change.
-- Editing a variation's content also counts as editing its template (library "edited" time).
-- See DEVELOPMENT.md §5.2.

create or replace function public.protect_variation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.is_original and new.content is distinct from old.content then
    raise exception 'The Original is locked; save a new variation instead' using errcode = 'check_violation';
  end if;
  if new.template_id is distinct from old.template_id
     or new.is_original is distinct from old.is_original
     or new.owner_id is distinct from old.owner_id
     or (new.parent_variation_id is distinct from old.parent_variation_id
         and new.parent_variation_id is not null) then
    raise exception 'Variation identity fields cannot be changed' using errcode = 'check_violation';
  end if;
  if old.is_original and (new.name is distinct from old.name or new.deleted_at is not null) then
    raise exception 'The Original is locked' using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger variations_touch_template_on_edit after update of content on public.variations
  for each row
  when (old.content is distinct from new.content)
  execute function public.touch_template_on_variation();
