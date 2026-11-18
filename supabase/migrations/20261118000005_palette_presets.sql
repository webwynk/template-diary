-- Palette presets (DEVELOPMENT.md Phase 8).
-- 1. Every color in a preset must be {hex, label?}: lowercase #rrggbb or #rrggbbaa, label ≤ 40.
-- 2. use_palette_preset(id): atomic use_count + 1 when a preset is applied.

create or replace function public.valid_preset_colors(p_colors jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_colors) is distinct from 'array' then false
    else coalesce((
      select bool_and(
        jsonb_typeof(e) = 'object'
        and (e - 'hex' - 'label') = '{}'::jsonb
        and jsonb_typeof(e -> 'hex') = 'string'
        and (e ->> 'hex') ~ '^#[0-9a-f]{6}([0-9a-f]{2})?$'
        and (
          not (e ? 'label')
          or jsonb_typeof(e -> 'label') = 'null'
          or (jsonb_typeof(e -> 'label') = 'string' and char_length(e ->> 'label') <= 40)
        )
      )
      from jsonb_array_elements(p_colors) as e
    ), true)
  end;
$$;

alter table public.palette_presets
  add constraint palette_presets_colors_valid check (public.valid_preset_colors(colors));

create or replace function public.use_palette_preset(p_id uuid)
returns integer
language sql
volatile
security invoker
set search_path = ''
as $$
  update public.palette_presets
     set use_count = use_count + 1
   where id = p_id
  returning use_count;
$$;

revoke execute on function public.use_palette_preset(uuid) from public, anon;
grant execute on function public.use_palette_preset(uuid) to authenticated;
