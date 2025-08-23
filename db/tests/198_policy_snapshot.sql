\pset tuples_only on
\pset format unaligned

select tablename, policyname, cmd, coalesce(qual::text,''), coalesce(with_check::text,'')
from pg_policies
where schemaname='public'
order by tablename, policyname, cmd;


