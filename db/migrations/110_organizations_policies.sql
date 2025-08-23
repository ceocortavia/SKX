-- 110_organizations_policies.sql

-- Sørg for RLS + FORCE (baseline kan allerede være aktivert)
alter table public.organizations enable row level security;
alter table public.organizations force  row level security;

-- Hjelpeuttrykk (GUC-lesing). Vi bruker inlined expressions for å unngå avhengighet til andre tabeller.
-- current_setting(..., true) returnerer NULL hvis ikke satt.

-- SELECT-policy: godkjente medlemmer i gjeldende org kan lese
drop policy if exists orgs_select_approved_context on public.organizations;
create policy orgs_select_approved_context
on public.organizations
for select
using (
  -- riktig org i kontekst
  id = nullif(current_setting('request.org_id', true), '')::uuid
  -- og godkjent status
  and current_setting('request.org_status', true) = 'approved'
);

-- UPDATE-policy: admin/owner + MFA ON, kun ufarlig felt (homepage_domain) kan endres
drop policy if exists orgs_update_admin_mfa on public.organizations;
create policy orgs_update_admin_mfa
on public.organizations
for update
using (
  id = nullif(current_setting('request.org_id', true), '')::uuid
  and current_setting('request.org_status', true) = 'approved'
  and current_setting('request.org_role',   true) in ('admin','owner')
)
with check (
  -- Samme kontekstkrav i WITH CHECK
  id = nullif(current_setting('request.org_id', true), '')::uuid
  and current_setting('request.org_status', true) = 'approved'
  and current_setting('request.org_role',   true) in ('admin','owner')
  and coalesce(current_setting('request.mfa', true),'off') = 'on'
  -- Tillat KUN endring av homepage_domain; alt annet må forbli uendret
  and orgnr          is not distinct from (select o2.orgnr         from public.organizations o2 where o2.id = public.organizations.id)
  and name           is not distinct from (select o2.name          from public.organizations o2 where o2.id = public.organizations.id)
  and org_form       is not distinct from (select o2.org_form      from public.organizations o2 where o2.id = public.organizations.id)
  and registered_at  is not distinct from (select o2.registered_at from public.organizations o2 where o2.id = public.organizations.id)
  and status_text    is not distinct from (select o2.status_text   from public.organizations o2 where o2.id = public.organizations.id)
  and raw_brreg_json is not distinct from (select o2.raw_brreg_json from public.organizations o2 where o2.id = public.organizations.id)
);

-- Ingen INSERT/DELETE-policies: opprettes/slettes kun via serverkontrollerte rutiner.

-- Gi RLS-rollen tilgang til å lese/oppdatere tabellen (RLS håndhever resten)
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app_client') then
    -- Just in case: create if missing (no login by default; app kan SET ROLE via pooler)
    create role app_client;
  end if;
end $$;

grant select, update on public.organizations to app_client;
