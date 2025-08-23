-- 130_memberships_policies.sql

-- Slå på/force RLS
alter table public.memberships enable row level security;
alter table public.memberships force  row level security;

-- SELECT 1: Egen membership for alle (approved/pending/blocked)
drop policy if exists ms_select_self on public.memberships;
create policy ms_select_self
on public.memberships
for select
using (
  user_id = nullif(current_setting('request.user_id', true), '')::uuid
);

-- SELECT 2: Admin/Owner i org-kontekst kan se alle i sin org (krever approved org-status)
drop policy if exists ms_select_org_admin on public.memberships;
create policy ms_select_org_admin
on public.memberships
for select
using (
  organization_id = nullif(current_setting('request.org_id', true), '')::uuid
  and current_setting('request.org_status', true) = 'approved'
  and current_setting('request.org_role',   true) in ('admin','owner')
);

-- UPDATE: Admin/Owner + MFA=on i org-kontekst kan endre rolle/status
drop policy if exists ms_update_admin_mfa on public.memberships;
create policy ms_update_admin_mfa
on public.memberships
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

-- Ingen INSERT/DELETE fra klient (skjer via serverflow/invitasjoner)
-- (Derfor lager vi ikke insert/delete-policies)

-- LAST-OWNER-GUARD: trigger som forhindrer at siste owner i en org forsvinner
create or replace function app.guard_last_owner_membership()
returns trigger language plpgsql as $$
declare remaining_owners int;
begin
  if tg_op = 'UPDATE' then
    -- Hvis raden var aktiv owner og blir nedgradert (ikke owner eller ikke approved)
    if old.role = 'owner' and old.status = 'approved'
       and (new.role <> 'owner' or new.status <> 'approved') then
      select count(*) into remaining_owners
      from public.memberships
      where organization_id = old.organization_id
        and (user_id, organization_id) <> (old.user_id, old.organization_id)
        and role = 'owner' and status = 'approved';
      if remaining_owners = 0 then
        raise exception 'Cannot demote the last approved owner of the organization';
      end if;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.role = 'owner' and old.status = 'approved' then
      select count(*) into remaining_owners
      from public.memberships
      where organization_id = old.organization_id
        and (user_id, organization_id) <> (old.user_id, old.organization_id)
        and role = 'owner' and status = 'approved';
      if remaining_owners = 0 then
        raise exception 'Cannot delete the last approved owner of the organization';
      end if;
    end if;
    return old;
  end if;
  return coalesce(new, old);
end$$;

drop trigger if exists tg_memberships_guard_last_owner on public.memberships;
create trigger tg_memberships_guard_last_owner
before update or delete on public.memberships
for each row execute function app.guard_last_owner_membership();

-- Gi tabellprivilegier til RLS-klientrollen (RLS håndhever resten)
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app_client') then
    create role app_client;
  end if;
end $$;

grant select, update on public.memberships to app_client;
