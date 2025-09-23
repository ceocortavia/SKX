-- 232_users_grants.sql
-- Gi RLS-klientrollen nødvendige tabellprivilegier på public.users

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app_client') then
    create role app_client; -- no login; SET ROLE via pooler/owner
  end if;
end $$;

grant select, update on public.users to app_client;


