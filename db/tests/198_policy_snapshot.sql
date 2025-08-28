-- Policy snapshot: RLS policies for public schema
-- Formatering håndteres av psql-flagg: -A (unaligned), -t (tuples-only)
select
  schemaname       as schema,
  tablename        as table,
  policyname,
  cmd,
  coalesce(qual::text,'')       as qual,
  coalesce(with_check::text,'') as with_check
from pg_policies
where schemaname = 'public'
order by schemaname, tablename, policyname, cmd;


