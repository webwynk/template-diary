-- Keep-alive for the Free plan (DEVELOPMENT.md §7 "Keep-alive"). Vercel Cron calls
-- GET /api/keep-alive once a day, which calls this through PostgREST with the anon key, so the
-- project sees database activity and isn't paused. It returns a constant: no table is read and
-- nothing changes, so anon still has no access to any row.
create function public.keep_alive()
returns boolean
language sql
stable
set search_path = ''
as $$
  select true;
$$;

revoke execute on function public.keep_alive() from public;
grant execute on function public.keep_alive() to anon, authenticated;
