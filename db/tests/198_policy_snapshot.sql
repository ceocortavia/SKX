-- Policy snapshot: RLS policies for public schema
-- Formatering håndteres av psql-flagg: -A (unaligned), -t (tuples-only)
select
  n.nspname       as schema,
  c.relname       as table,
  p.policyname,
  p.cmd,
  coalesce(p.qual::text,'')       as qual,
  coalesce(p.with_check::text,'') as with_check
from pg_policies p
join pg_class c      on c.oid = p.tableoid
join pg_namespace n  on n.oid = c.relnamespace
where n.nspname = 'public'
order by n.nspname, c.relname, p.policyname, p.cmd;


