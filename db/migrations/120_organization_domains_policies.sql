-- 120_organization_domains_policies.sql

-- RLS på/force
alter table public.organization_domains enable row level security;
alter table public.organization_domains force  row level security;

-- SELECT: approved medlemmer i gjeldende org
drop policy if exists org_domains_select_approved on public.organization_domains;
create policy org_domains_select_approved
on public.organization_domains
for select
using (
  organization_id = nullif(current_setting('request.org_id', true), '')::uuid
  and current_setting('request.org_status', true) = 'approved'
);

-- INSERT: admin/owner + MFA=on, i gjeldende org
drop policy if exists org_domains_insert_admin_mfa on public.organization_domains;
create policy org_domains_insert_admin_mfa
on public.organization_domains
for insert
with check (
  organization_id = nullif(current_setting('request.org_id', true), '')::uuid
  and current_setting('request.org_status', true) = 'approved'
  and current_setting('request.org_role',   true) in ('admin','owner')
  and coalesce(current_setting('request.mfa', true),'off') = 'on'
);

-- UPDATE: admin/owner + MFA=on, i gjeldende org
drop policy if exists org_domains_update_admin_mfa on public.organization_domains;
create policy org_domains_update_admin_mfa
on public.organization_domains
for update
using (
  organization_id = nullif(current_setting('request.org_id', true), '')::uuid
  and current_setting('request.org_status', true) = 'approved'
  and current_setting('request.org_role',   true) in ('admin','owner')
  and coalesce(current_setting('request.mfa', true),'off') = 'on'
)
with check (
  organization_id = nullif(current_setting('request.org_id', true), '')::uuid
  and current_setting('request.org_status', true) = 'approved'
  and current_setting('request.org_role',   true) in ('admin','owner')
  and coalesce(current_setting('request.mfa', true),'off') = 'on'
);

-- DELETE: admin/owner + MFA=on, i gjeldende org
drop policy if exists org_domains_delete_admin_mfa on public.organization_domains;
create policy org_domains_delete_admin_mfa
on public.organization_domains
for delete
using (
  organization_id = nullif(current_setting('request.org_id', true), '')::uuid
  and current_setting('request.org_status', true) = 'approved'
  and current_setting('request.org_role',   true) in ('admin','owner')
  and coalesce(current_setting('request.mfa', true),'off') = 'on'
);

-- Triggervern: ikke slett/disable siste verifiserte domene
create or replace function app.guard_last_verified_domain()
returns trigger language plpgsql as $$
declare remaining int;
begin
  if tg_op = 'DELETE' then
    if old.verified then
      select count(*) into remaining
      from public.organization_domains
      where organization_id = old.organization_id
        and id <> old.id
        and verified = true;
      if remaining = 0 then
        raise exception 'Cannot delete the last verified domain for this organization';
      end if;
    end if;
    return old;
  elsif tg_op = 'UPDATE' then
    if old.verified = true and new.verified = false then
      select count(*) into remaining
      from public.organization_domains
      where organization_id = old.organization_id
        and id <> old.id
        and verified = true;
      if remaining = 0 then
        raise exception 'Cannot unverify the last verified domain for this organization';
      end if;
    end if;
    return new;
  end if;
  return coalesce(new, old);
end$$;

drop trigger if exists tg_domains_guard_last_verified on public.organization_domains;
create trigger tg_domains_guard_last_verified
before update or delete on public.organization_domains
for each row execute function app.guard_last_verified_domain();

-- Gi RLS-klientrollen tabell-privilegier (RLS håndhever resten)
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app_client') then
    create role app_client;
  end if;
end $$;

grant select, insert, update, delete on public.organization_domains to app_client;
