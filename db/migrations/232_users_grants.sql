-- RLS-verifisering: gi app-klienten lesetilgang til public.users (tilpass rolle)
DO $$
BEGIN
  BEGIN
    EXECUTE 'GRANT SELECT ON TABLE public.users TO app_client';
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'public.users finnes ikke i dette skjemaet (hopper over)';
  WHEN invalid_grant_operation THEN
    RAISE NOTICE 'Rolle app_client finnes ikke (hopper over)';
  END;
END$$;

-- 232_users_grants.sql
-- Gi RLS-klientrollen nødvendige tabellprivilegier på public.users

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app_client') then
    create role app_client; -- no login; SET ROLE via pooler/owner
  end if;
end $$;

grant select, update on public.users to app_client;


