-- Tags with the number of live (not trashed) templates using each one.
-- Used by the sidebar and Settings → Tags. See DEVELOPMENT.md §5.3.

create or replace function public.list_tags_with_counts()
returns table (
  id uuid,
  name text,
  color text,
  created_at timestamptz,
  updated_at timestamptz,
  template_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    t.id,
    t.name,
    t.color,
    t.created_at,
    t.updated_at,
    count(tm.id) as template_count
  from public.tags t
  left join public.template_tags tt on tt.tag_id = t.id
  left join public.templates tm on tm.id = tt.template_id and tm.deleted_at is null
  group by t.id
  order by lower(t.name), t.id;
$$;

revoke execute on function public.list_tags_with_counts() from public, anon;
grant execute on function public.list_tags_with_counts() to authenticated;
