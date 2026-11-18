-- Template Diary: initial schema.
-- This file implements DEVELOPMENT.md §5 exactly. Never edit it after it has been applied;
-- write a new migration instead (RULES.md §3).

-------------------------------------------------------------------------------
-- Extensions
-------------------------------------------------------------------------------
create extension if not exists pg_trgm with schema extensions;

-------------------------------------------------------------------------------
-- Enums
-------------------------------------------------------------------------------
create type public.template_type as enum ('custom', 'elementor');
create type public.feature_image_source as enum ('none', 'auto', 'upload');

-------------------------------------------------------------------------------
-- Helpers
-------------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;

-------------------------------------------------------------------------------
-- tags
-------------------------------------------------------------------------------
create table public.tags (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 40),
  color       text not null default '#64748B' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, owner_id)
);
create unique index tags_owner_name_uq on public.tags (owner_id, lower(btrim(name)));
create trigger tags_updated_at before update on public.tags
  for each row execute function public.set_updated_at();

-------------------------------------------------------------------------------
-- templates
-------------------------------------------------------------------------------
create table public.templates (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name                  text not null check (char_length(btrim(name)) between 1 and 120),
  type                  public.template_type not null,
  notes                 text check (notes is null or char_length(notes) <= 5000),
  used_in               text check (used_in is null or char_length(used_in) <= 2000),
  is_favorite           boolean not null default false,
  feature_image_path    text,
  feature_image_source  public.feature_image_source not null default 'none',
  deleted_at            timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (id, owner_id),
  check ((feature_image_path is null) = (feature_image_source = 'none'))
);
create index templates_owner_live_idx on public.templates (owner_id, updated_at desc) where deleted_at is null;
create index templates_owner_trash_idx on public.templates (owner_id, deleted_at) where deleted_at is not null;
create index templates_name_trgm_idx on public.templates using gin (name extensions.gin_trgm_ops);
create trigger templates_updated_at before update on public.templates
  for each row execute function public.set_updated_at();

-- A template's type is fixed after creation.
create or replace function public.protect_template_type()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.type is distinct from old.type then
    raise exception 'Template type cannot be changed' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger templates_protect_type before update on public.templates
  for each row execute function public.protect_template_type();

-------------------------------------------------------------------------------
-- template_tags (many-to-many)
-------------------------------------------------------------------------------
create table public.template_tags (
  template_id uuid not null,
  tag_id      uuid not null,
  owner_id    uuid not null default auth.uid(),
  created_at  timestamptz not null default now(),
  primary key (template_id, tag_id),
  foreign key (template_id, owner_id) references public.templates (id, owner_id) on delete cascade,
  foreign key (tag_id, owner_id)      references public.tags (id, owner_id)      on delete cascade
);
create index template_tags_tag_idx on public.template_tags (tag_id);

-------------------------------------------------------------------------------
-- variations (the Original + named saves)
-------------------------------------------------------------------------------
create table public.variations (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null default auth.uid(),
  template_id          uuid not null,
  parent_variation_id  uuid,
  name                 text not null check (char_length(btrim(name)) between 1 and 120),
  is_original          boolean not null default false,
  content              text not null check (octet_length(content) between 1 and 5242880),
  detected             jsonb not null default '{}'::jsonb,
  changes              jsonb not null default '[]'::jsonb,
  used_in              text check (used_in is null or char_length(used_in) <= 2000),
  feature_image_path   text,
  deleted_at           timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (template_id, owner_id) references public.templates (id, owner_id) on delete cascade,
  foreign key (parent_variation_id, owner_id) references public.variations (id, owner_id)
    on delete set null (parent_variation_id),
  check (jsonb_typeof(detected) = 'object'),
  check (jsonb_typeof(changes) = 'array'),
  check (not is_original or (parent_variation_id is null and deleted_at is null))
);
create unique index variations_one_original_uq on public.variations (template_id) where is_original;
create unique index variations_name_uq on public.variations (template_id, lower(btrim(name))) where deleted_at is null;
create index variations_template_idx on public.variations (template_id, created_at desc);
create index variations_parent_idx on public.variations (parent_variation_id) where parent_variation_id is not null;
create index variations_name_trgm_idx on public.variations using gin (name extensions.gin_trgm_ops);
create trigger variations_updated_at before update on public.variations
  for each row execute function public.set_updated_at();

-- Content is append-only; the Original is fully locked.
create or replace function public.protect_variation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.content is distinct from old.content then
    raise exception 'Variation content is immutable; save a new variation instead' using errcode = 'check_violation';
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
create trigger variations_protect before update on public.variations
  for each row execute function public.protect_variation();

-------------------------------------------------------------------------------
-- palette_presets
-------------------------------------------------------------------------------
create table public.palette_presets (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  colors      jsonb not null default '[]'::jsonb,
  use_count   integer not null default 0 check (use_count >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (jsonb_typeof(colors) = 'array' and jsonb_array_length(colors) between 1 and 32)
);
create unique index palette_presets_owner_name_uq on public.palette_presets (owner_id, lower(btrim(name)));
create trigger palette_presets_updated_at before update on public.palette_presets
  for each row execute function public.set_updated_at();

-------------------------------------------------------------------------------
-- user_settings (one row per user)
-------------------------------------------------------------------------------
create table public.user_settings (
  owner_id               uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  default_device         integer not null default 1440 check (default_device in (1440, 768, 375)),
  default_feature_mode   public.feature_image_source not null default 'auto' check (default_feature_mode <> 'none'),
  trash_retention_days   integer not null default 30 check (trash_retention_days between 1 and 365),
  last_backup_at         timestamptz,
  updated_at             timestamptz not null default now()
);
create trigger user_settings_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();

-------------------------------------------------------------------------------
-- RPC: create a template and its Original atomically
-------------------------------------------------------------------------------
create or replace function public.create_template(
  p_name text,
  p_type public.template_type,
  p_content text,
  p_tag_ids uuid[] default '{}',
  p_notes text default null,
  p_used_in text default null,
  p_detected jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_template_id uuid;
begin
  insert into public.templates (name, type, notes, used_in)
  values (btrim(p_name), p_type, p_notes, p_used_in)
  returning id into v_template_id;

  insert into public.variations (template_id, name, is_original, content, detected)
  values (v_template_id, 'Original', true, p_content, p_detected);

  if coalesce(array_length(p_tag_ids, 1), 0) > 0 then
    insert into public.template_tags (template_id, tag_id)
    select v_template_id, t.tag_id from unnest(p_tag_ids) as t (tag_id);
  end if;

  return v_template_id;
end $$;

-------------------------------------------------------------------------------
-- Privileges: nothing for anon; authenticated works through RLS
-------------------------------------------------------------------------------
revoke all on public.tags, public.templates, public.template_tags, public.variations,
  public.palette_presets, public.user_settings from anon;
revoke execute on function public.create_template(text, public.template_type, text, uuid[], text, text, jsonb)
  from public, anon;
grant execute on function public.create_template(text, public.template_type, text, uuid[], text, text, jsonb)
  to authenticated;

-------------------------------------------------------------------------------
-- Row Level Security
-------------------------------------------------------------------------------
alter table public.tags            enable row level security;
alter table public.templates       enable row level security;
alter table public.template_tags   enable row level security;
alter table public.variations      enable row level security;
alter table public.palette_presets enable row level security;
alter table public.user_settings   enable row level security;

create policy "owner select" on public.tags for select to authenticated using (owner_id = (select auth.uid()));
create policy "owner insert" on public.tags for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "owner update" on public.tags for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "owner delete" on public.tags for delete to authenticated using (owner_id = (select auth.uid()));

create policy "owner select" on public.templates for select to authenticated using (owner_id = (select auth.uid()));
create policy "owner insert" on public.templates for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "owner update" on public.templates for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "owner delete" on public.templates for delete to authenticated using (owner_id = (select auth.uid()));

create policy "owner select" on public.template_tags for select to authenticated using (owner_id = (select auth.uid()));
create policy "owner insert" on public.template_tags for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "owner update" on public.template_tags for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "owner delete" on public.template_tags for delete to authenticated using (owner_id = (select auth.uid()));

create policy "owner select" on public.variations for select to authenticated using (owner_id = (select auth.uid()));
create policy "owner insert" on public.variations for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "owner update" on public.variations for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
-- The Original can never be deleted directly; it only goes when its template is purged.
create policy "owner delete" on public.variations for delete to authenticated using (owner_id = (select auth.uid()) and not is_original);

create policy "owner select" on public.palette_presets for select to authenticated using (owner_id = (select auth.uid()));
create policy "owner insert" on public.palette_presets for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "owner update" on public.palette_presets for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "owner delete" on public.palette_presets for delete to authenticated using (owner_id = (select auth.uid()));

create policy "owner select" on public.user_settings for select to authenticated using (owner_id = (select auth.uid()));
create policy "owner insert" on public.user_settings for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "owner update" on public.user_settings for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "owner delete" on public.user_settings for delete to authenticated using (owner_id = (select auth.uid()));

-------------------------------------------------------------------------------
-- Storage: private bucket for feature images, one folder per user
-------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feature-images', 'feature-images', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "feature images: own folder read" on storage.objects for select to authenticated
  using (bucket_id = 'feature-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "feature images: own folder insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'feature-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "feature images: own folder update" on storage.objects for update to authenticated
  using (bucket_id = 'feature-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'feature-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "feature images: own folder delete" on storage.objects for delete to authenticated
  using (bucket_id = 'feature-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
