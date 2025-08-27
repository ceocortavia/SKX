-- Policy snapshot: RLS policies for public schema
-- Formatering håndteres av psql-flagg: -A (unaligned), -t (tuples-only)
select tablename, policyname, cmd, coalesce(qual::text,''), coalesce(with_check::text,'')
from pg_policies
where schemaname='public'
order by tablename, policyname, cmd;


