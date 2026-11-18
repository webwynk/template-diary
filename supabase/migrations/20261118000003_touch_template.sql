-- Saving a variation counts as editing its template: the library sorts by templates.updated_at
-- and shows "edited 2d ago". Done in the database so it is atomic with the insert.
-- See DEVELOPMENT.md §5.2.

create or replace function public.touch_template_on_variation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- set_updated_at (before update) sets updated_at = now(); RLS still applies to this update.
  update public.templates
     set updated_at = now()
   where id = new.template_id
     and owner_id = new.owner_id;
  return null;
end $$;

create trigger variations_touch_template after insert on public.variations
  for each row execute function public.touch_template_on_variation();
