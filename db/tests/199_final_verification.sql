\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

SET ROLE neondb_owner;

-- Seed orgs/users idempotent
insert into public.organizations (orgnr,name,homepage_domain,org_form,registered_at,status_text,raw_brreg_json)
select '123456789','TestOrg AS','example.org','AS','2020-01-01','Active','{"source":"seed"}'::jsonb where not exists (select 1 from public.organizations where orgnr='123456789');
insert into public.organizations (orgnr,name,homepage_domain,org_form,registered_at,status_text,raw_brreg_json)
select '987654321','DomainOrg AS','domainorg.no','AS','2021-01-01','Active','{"source":"seed"}'::jsonb where not exists (select 1 from public.organizations where orgnr='987654321');
insert into public.users (clerk_user_id,primary_email,full_name,mfa_level)
select 'user_a','a@example.com','Alice','none' where not exists (select 1 from public.users where clerk_user_id='user_a');
insert into public.users (clerk_user_id,primary_email,full_name,mfa_level)
select 'user_b','b@example.com','Bob','none'   where not exists (select 1 from public.users where clerk_user_id='user_b');
insert into public.users (clerk_user_id,primary_email,full_name,mfa_level)
select 'user_p','p@example.com','Pending','none' where not exists (select 1 from public.users where clerk_user_id='user_p');
insert into public.users (clerk_user_id,primary_email,full_name,mfa_level)
select 'user_m','m@example.com','Member','none' where not exists (select 1 from public.users where clerk_user_id='user_m');
insert into public.users (clerk_user_id,primary_email,full_name,mfa_level)
select 'user_c','c@example.com','CoOwner','none' where not exists (select 1 from public.users where clerk_user_id='user_c');

-- Capture IDs up-front
select id::text as ua  from public.users where clerk_user_id='user_a'; \gset
select id::text as ub  from public.users where clerk_user_id='user_b'; \gset
select id::text as up  from public.users where clerk_user_id='user_p'; \gset
select id::text as um  from public.users where clerk_user_id='user_m'; \gset
select id::text as uc  from public.users where clerk_user_id='user_c'; \gset
select id::text as org1 from public.organizations where orgnr='123456789'; \gset
select id::text as org2 from public.organizations where orgnr='987654321'; \gset

-- Reseed domains for org2 (guard disabled only during seed)
ALTER TABLE public.organization_domains DISABLE TRIGGER tg_domains_guard_last_verified;
DELETE FROM public.organization_domains WHERE organization_id=:'org2'::uuid;
INSERT INTO public.organization_domains (organization_id,domain,verified)
VALUES (:'org2'::uuid,'verified.no',true), (:'org2'::uuid,'extra.no',false);
ALTER TABLE public.organization_domains ENABLE TRIGGER tg_domains_guard_last_verified;

-- 🔧 Disable last-owner guard kun under seeding
ALTER TABLE public.memberships DISABLE TRIGGER tg_memberships_guard_last_owner;

-- Sett GUC som brukes inne i DO
SET request.org_id = :'org1';
SET request.ua = :'ua';
SET request.ub = :'ub';
SET request.um = :'um';
SET request.up = :'up';

DO $$
DECLARE
  o  uuid := nullif(current_setting('request.org_id', true), '')::uuid;
  ua uuid := nullif(current_setting('request.ua',      true), '')::uuid;
  ub uuid := nullif(current_setting('request.ub',      true), '')::uuid;
  um uuid := nullif(current_setting('request.um',      true), '')::uuid;
  up uuid := nullif(current_setting('request.up',      true), '')::uuid;
BEGIN
  -- Rydd og seed
  DELETE FROM public.memberships WHERE organization_id = o;

  INSERT INTO public.memberships (user_id, organization_id, role,  status,    approved_by, approved_at)
  VALUES
    (ua, o, 'owner',  'approved', ua, now()),
    (ub, o, 'admin',  'approved', ua, now()),
    (um, o, 'member', 'approved', ua, now()),
    (up, o, 'member', 'pending',  ua, now());

  -- (valgfritt) forhåndsopprett en co-owner for å unngå guard senere i testen
  -- UPDATE public.memberships
  --    SET role='owner'
  --  WHERE organization_id = o AND user_id = :'ub'::uuid;
END$$;

-- Nullstill GUC brukt i seeding
RESET request.org_id; RESET request.ua; RESET request.ub; RESET request.um; RESET request.up;

-- 🔒 Re-enable guard umiddelbart etter seeding
ALTER TABLE public.memberships ENABLE TRIGGER tg_memberships_guard_last_owner;

-- Hurtigsjekk: minst 1 approved owner etter seeding
select 'SEED_OWNER_COUNT', count(*)
from public.memberships
where organization_id = :'org1'::uuid and role='owner' and status='approved';

-- Clean invitations/audit
DELETE FROM public.invitations  WHERE organization_id=:'org1'::uuid;
-- Audit-events er append-only, så vi nullstiller ikke her
-- DELETE FROM public.audit_events WHERE actor_org_id   =:'org1'::uuid;

-- Pre-seed audit events before RLS role
INSERT INTO public.audit_events (id,actor_user_id,actor_org_id,action,target_table,target_pk,metadata,created_at)
VALUES (gen_random_uuid(),:'ua'::uuid, :'org1'::uuid,'org.update_homepage','organizations', :'org1'::uuid,'{"by":"owner"}',now()),
       (gen_random_uuid(),:'ub'::uuid, :'org1'::uuid,'membership.read_self','memberships',null,'{"by":"member"}',now()),
       (gen_random_uuid(),:'up'::uuid, :'org1'::uuid,'invite.view','invitations',null,'{"by":"pending"}',now());

-- Switch to RLS role
SET ROLE app_client;

-- 🔒 Set RLS session context for the "actor" we want to test as
SET request.user_id = :'ua';         -- seeded admin/owner user id
SET request.org_id  = :'org1';       -- seeded org id
SET request.mfa     = 'on';          -- policies require MFA

-- USERS (GUC-only in queries/DO)
SET request.clerk_user_id='user_a';
SET request.user_id=:'ua';
select 'U_A_SELF', count(*) from public.users where id = nullif(current_setting('request.user_id',true),'')::uuid;
with upd as (
  update public.users set full_name='Alice Final'
  where id = nullif(current_setting('request.user_id',true),'')::uuid returning 1
) select 'U_A_UPDATE_SELF_ROWS', coalesce(count(*),0) from upd;
DO $$ BEGIN BEGIN
  update public.users set mfa_level='totp'
  where id = nullif(current_setting('request.user_id',true),'')::uuid;
  RAISE NOTICE 'U_A_UPDATE_MFA: UNEXPECTED';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'U_A_UPDATE_MFA: DENIED_OK (%)', SQLERRM; END; END $$;
SET request.ub = :'ub';
with upd as (
  update public.users set full_name='Bob Hacked'
  where id = nullif(current_setting('request.ub', true), '')::uuid returning 1
) select 'U_A_UPDATE_BOB_ROWS', coalesce(count(*),0) from upd;
RESET request.ub;

-- ORGANIZATIONS
SET request.org_id=:'org1'; SET request.org_role='member'; SET request.org_status='approved'; SET request.mfa='off';
select 'O_MEMBER_SELECT', count(*) from public.organizations where id=:'org1'::uuid;
SET request.org_role='admin'; SET request.mfa='off';
DO $$ BEGIN BEGIN
  update public.organizations set homepage_domain='admin-no-mfa.final'
  where id= nullif(current_setting('request.org_id',true),'')::uuid;
  RAISE NOTICE 'O_ADMIN_NO_MFA: UNEXPECTED';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'O_ADMIN_NO_MFA: DENIED_OK (%)', SQLERRM; END; END $$;
SET request.mfa='on';
with upd as (
  update public.organizations set homepage_domain='admin-with-mfa.final'
  where id= nullif(current_setting('request.org_id',true),'')::uuid returning 1
) select 'O_ADMIN_MFA_ROWS', coalesce(count(*),0) from upd;
DO $$ BEGIN BEGIN
  update public.organizations set name='BRREG Haxx'
  where id= nullif(current_setting('request.org_id',true),'')::uuid;
  RAISE NOTICE 'O_ADMIN_BRREG: UNEXPECTED';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'O_ADMIN_BRREG: DENIED_OK (%)', SQLERRM; END; END $$;
SET request.org_status='pending';
select 'O_PENDING_SELECT', count(*) from public.organizations where id= nullif(current_setting('request.org_id',true),'')::uuid;
RESET request.org_id; RESET request.org_role; RESET request.org_status; SET request.mfa='off';
select 'O_ANON_SELECT', count(*) from public.organizations where id=:'org1'::uuid;

-- ORGANIZATION_DOMAINS
SET request.org_id=:'org2'; SET request.org_status='approved'; SET request.org_role='member'; SET request.mfa='off';
select 'D_MEMBER_SELECT', count(*) from public.organization_domains where organization_id= nullif(current_setting('request.org_id',true),'')::uuid;
DO $$ BEGIN BEGIN
  insert into public.organization_domains (organization_id,domain,verified)
  values (nullif(current_setting('request.org_id',true),'')::uuid,'member-add.final',false);
  RAISE NOTICE 'D_MEMBER_INSERT: UNEXPECTED';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'D_MEMBER_INSERT: DENIED_OK (%)', SQLERRM; END; END $$;
SET request.org_role='admin'; SET request.mfa='off';
with upd as (
  update public.organization_domains set domain='admin-no-mfa.final'
  where organization_id= nullif(current_setting('request.org_id',true),'')::uuid and domain='extra.no' returning 1
) select 'D_ADMIN_NO_MFA_ROWS', coalesce(count(*),0) from upd;
SET request.mfa='on';
with ins as (
  insert into public.organization_domains (organization_id,domain,verified)
  values (nullif(current_setting('request.org_id',true),'')::uuid,'admin-add.final',false) returning 1
) select 'D_ADMIN_INSERT_ROWS', coalesce(count(*),0) from ins;
with upd as (
  update public.organization_domains set verified=true
  where organization_id= nullif(current_setting('request.org_id',true),'')::uuid and domain='extra.no' returning 1
) select 'D_ADMIN_UPDATE_ROWS', coalesce(count(*),0) from upd;
with del as (
  delete from public.organization_domains
  where organization_id= nullif(current_setting('request.org_id',true),'')::uuid and domain='admin-add.final' returning 1
) select 'D_ADMIN_DELETE_ROWS', coalesce(count(*),0) from del;
with upd as (
  update public.organization_domains set verified=false
  where organization_id= nullif(current_setting('request.org_id',true),'')::uuid and domain='extra.no' returning 1
) select 'D_ADMIN_UNVERIFY_EXTRA_ROWS', coalesce(count(*),0) from upd;
DO $$ BEGIN BEGIN
  delete from public.organization_domains
  where organization_id= nullif(current_setting('request.org_id',true),'')::uuid and domain='verified.no';
  RAISE NOTICE 'D_DELETE_LAST_VERIFIED: UNEXPECTED';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'D_DELETE_LAST_VERIFIED: DENIED_OK (%)', SQLERRM; END; END $$;

-- MEMBERSHIPS
SET request.org_id=:'org1'; SET request.user_id=:'um'; SET request.org_role='member'; SET request.org_status='approved'; SET request.mfa='off';
select 'M_MEMBER_SELF', count(*) from public.memberships where user_id = nullif(current_setting('request.user_id',true),'')::uuid and organization_id= nullif(current_setting('request.org_id',true),'')::uuid;
select 'M_MEMBER_OTHERS', count(*) from public.memberships where organization_id= nullif(current_setting('request.org_id',true),'')::uuid and user_id<> nullif(current_setting('request.user_id',true),'')::uuid;
SET request.user_id=:'ub'; SET request.org_role='admin'; SET request.org_status='approved'; SET request.mfa='off';
select 'M_ADMIN_ALL', count(*) from public.memberships where organization_id= nullif(current_setting('request.org_id',true),'')::uuid;
SET request.up = :'up';
with upd as (
  update public.memberships set status='approved'
  where organization_id= nullif(current_setting('request.org_id',true),'')::uuid and user_id= nullif(current_setting('request.up', true), '')::uuid returning 1
) select 'M_ADMIN_APPROVE_NO_MFA_ROWS', coalesce(count(*),0) from upd;
RESET request.up;
SET request.mfa='on';
with upd as (
  update public.memberships set status='approved'
  where organization_id= nullif(current_setting('request.org_id',true),'')::uuid and user_id= nullif(current_setting('request.up', true), '')::uuid returning 1
) select 'M_ADMIN_APPROVE_ROWS', coalesce(count(*),0) from upd;
SET request.um = :'um';
with upd as (
  update public.memberships set role='admin'
  where organization_id= nullif(current_setting('request.org_id',true),'')::uuid and user_id= nullif(current_setting('request.um', true), '')::uuid returning 1
) select 'M_PROMOTE_ROWS', coalesce(count(*),0) from upd;
RESET request.um;
SET request.user_id=:'ua'; SET request.org_role='owner';
DO $$ BEGIN BEGIN
  update public.memberships set role='admin'
  where organization_id= nullif(current_setting('request.org_id',true),'')::uuid and user_id= nullif(current_setting('request.user_id',true),'')::uuid;
  RAISE NOTICE 'M_OWNER_DOWNGRADE_LAST: UNEXPECTED';
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'M_OWNER_DOWNGRADE_LAST: DENIED_OK (%)', SQLERRM; END; END $$;
SET request.user_id=:'ub';
with upd as (
  update public.memberships set role='owner'
  where organization_id= nullif(current_setting('request.org_id',true),'')::uuid and user_id= nullif(current_setting('request.user_id',true),'')::uuid returning 1
) select 'M_ADMIN_TO_OWNER_ROWS', coalesce(count(*),0) from upd;
SET request.user_id=:'ua';
with upd as (
  update public.memberships set role='admin'
  where organization_id= nullif(current_setting('request.org_id',true),'')::uuid and user_id= nullif(current_setting('request.user_id',true),'')::uuid returning 1
) select 'M_OWNER_DOWNGRADE_AFTER_COOWNER_ROWS', coalesce(count(*),0) from upd;
SET request.user_id=:'up'; SET request.org_role='member'; SET request.org_status='pending'; SET request.mfa='off';
select 'M_PENDING_SELF', count(*) from public.memberships where organization_id= nullif(current_setting('request.org_id',true),'')::uuid and user_id= nullif(current_setting('request.user_id',true),'')::uuid;
select 'M_PENDING_ALL',  count(*) from public.memberships where organization_id= nullif(current_setting('request.org_id',true),'')::uuid;

-- INVITATIONS
RESET request.user_id; SET request.org_id=:'org1'; SET request.org_role='admin'; SET request.org_status='approved'; SET request.mfa='on'; SET request.clerk_user_email='admin@example.com';
with ins as (
  insert into public.invitations (organization_id,email,requested_role,status,expires_at)
  values (nullif(current_setting('request.org_id',true),'')::uuid,'inv.final@ex.com','member','pending',now()+interval '7 days'),
         (nullif(current_setting('request.org_id',true),'')::uuid,'inv2.final@ex.com','admin','pending',now()+interval '7 days') returning 1
) select 'I_ADMIN_INSERT_ROWS', coalesce(count(*),0) from ins;
select 'I_ADMIN_SELECT_ALL', count(*) from public.invitations where organization_id= nullif(current_setting('request.org_id',true),'')::uuid;
with upd as (
  update public.invitations set status='revoked'
  where organization_id= nullif(current_setting('request.org_id',true),'')::uuid and email='inv2.final@ex.com' returning 1
) select 'I_ADMIN_REVOKE_ROWS', coalesce(count(*),0) from upd;
RESET request.org_role; RESET request.org_status; SET request.mfa='off'; SET request.clerk_user_email='inv.final@ex.com';
select 'I_INVITEE_SELECT_SELF', count(*) from public.invitations where email= nullif(current_setting('request.clerk_user_email',true),'');
with upd as (
  update public.invitations set status='accepted'
  where email= nullif(current_setting('request.clerk_user_email',true),'') returning 1
) select 'I_INVITEE_ACCEPT_ROWS', coalesce(count(*),0) from upd;
SET request.clerk_user_email='other@ex.com';
select 'I_OTHER_SELECT_ANY', count(*) from public.invitations where organization_id= nullif(current_setting('request.org_id',true),'')::uuid;
RESET request.clerk_user_email;
select 'I_ANON_SELECT_ANY', count(*) from public.invitations where organization_id= nullif(current_setting('request.org_id',true),'')::uuid;

-- AUDIT_EVENTS
SET request.org_id=:'org1';
SET request.user_id=:'ua'; SET request.org_role='owner'; SET request.org_status='approved'; SET request.mfa='on';
select 'AE_OWNER_ALL', count(*) from public.audit_events;
SET request.user_id=:'ub'; SET request.org_role='member'; SET request.org_status='approved'; SET request.mfa='off';
select 'AE_MEMBER_OWN',   count(*) from public.audit_events where actor_user_id= :'ub'::uuid;
select 'AE_MEMBER_TOTAL', count(*) from public.audit_events;
SET request.user_id=:'up'; SET request.org_role='member'; SET request.org_status='pending'; SET request.mfa='off';
select 'AE_PENDING_OWN', count(*) from public.audit_events where actor_user_id= :'up'::uuid;
RESET request.user_id; RESET request.org_role; RESET request.org_status; SET request.mfa='off';
select 'AE_ANON_TOTAL', count(*) from public.audit_events;
-- Audit-events er append-only, så vi tester ikke UPDATE/DELETE her
-- DO $$ BEGIN BEGIN update public.audit_events set action='tamper' where true; RAISE NOTICE 'AE_UPDATE: UNEXPECTED'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'AE_UPDATE: DENIED_OK (%)', SQLERRM; END; END $$;
-- DO $$ BEGIN BEGIN delete from public.audit_events where true; RAISE NOTICE 'AE_DELETE: UNEXPECTED'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'AE_DELETE: DENIED_OK (%)', SQLERRM; END; END $$;
