-- 140_invitations_policies.sql

alter table public.invitations enable row level security;
alter table public.invitations force  row level security;

-- SELECT: Admin/Owner i approved org ser alle invitasjoner i orgen.
--         I tillegg: en bruker kan se invitasjon(er) som matcher egen e-post.
drop policy if exists inv_select_org_admin on public.invitations;
create policy inv_select_org_admin
on public.invitations
for select
using (
  ( organization_id = nullif(current_setting('request.org_id', true), '')::uuid
    and current_setting('request.org_status', true) = 'approved'
    and current_setting('request.org_role',   true) in ('admin','owner')
  )
  or
  ( email = nullif(current_setting('request.clerk_user_email', true), '') )
);

-- INSERT: Admin/Owner + MFA=on i approved org
drop policy if exists inv_insert_admin_mfa on public.invitations;
create policy inv_insert_admin_mfa
on public.invitations
for insert
with check (
  organization_id = nullif(current_setting('request.org_id', true), '')::uuid
  and current_setting('request.org_status', true) = 'approved'
  and current_setting('request.org_role',   true) in ('admin','owner')
  and coalesce(current_setting('request.mfa', true),'off') = 'on'
);

-- UPDATE (revoke): Admin/Owner + MFA=on i approved org kan sette status='revoked'
drop policy if exists inv_update_admin_mfa_revoke on public.invitations;
create policy inv_update_admin_mfa_revoke
on public.invitations
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
  and status in ('pending','revoked')
);

-- UPDATE (accept): Inviterte kan sette status='accepted' KUN på egen e-post
drop policy if exists inv_update_invitee_accept on public.invitations;
create policy inv_update_invitee_accept
on public.invitations
for update
using ( email = nullif(current_setting('request.clerk_user_email', true), '') )
with check (
  email = nullif(current_setting('request.clerk_user_email', true), '')
  and status in ('pending','accepted')
);

-- Rolleprivilegier til RLS-klient
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app_client') then
    create role app_client;
  end if;
end $$;

grant select, insert, update on public.invitations to app_client;
