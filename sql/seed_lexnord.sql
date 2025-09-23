-- seed_lexnord.sql – LexNord MVP seed
-- Safe to run multiple times (upsert / ON CONFLICT).

begin;

-- 1. Opprett eller finn LexNord-organisasjonen
with upsert_org as (
  insert into public.organizations (orgnr, name, homepage_domain, status_text)
  values ('920123456', 'LexNord Advokat AS', 'lexnord.test', 'AKTIV')
  on conflict (orgnr) do update
    set name = excluded.name,
        homepage_domain = excluded.homepage_domain,
        status_text = excluded.status_text,
        updated_at = now()
  returning id
)
select id from upsert_org;

-- 2. Opprett brukere (admin, advokater, assistent)
insert into public.users (clerk_user_id, primary_email, full_name)
values
  ('lex_admin_1', 'admin1@lexnord.test', 'Admin One'),
  ('lex_admin_2', 'admin2@lexnord.test', 'Admin Two'),
  ('lex_advokat_1', 'advokat1@lexnord.test', 'Advokat Junior'),
  ('lex_advokat_2', 'advokat2@lexnord.test', 'Advokat Senior'),
  ('lex_assistent_1', 'assistent@lexnord.test', 'Fagassistent')
on conflict (clerk_user_id) do update
  set primary_email = excluded.primary_email,
      full_name = excluded.full_name,
      updated_at = now();

-- 3. Knytt medlemmer / roller
with org as (
  select id from public.organizations where orgnr = '920123456' limit 1
)
insert into public.memberships (user_id, organization_id, role, status)
select u.id,
       (select id from org),
       (member_role.role)::member_role,
       (member_role.status)::membership_status
from public.users u
join (values
  ('admin1@lexnord.test', 'owner', 'approved'),
  ('admin2@lexnord.test', 'admin', 'approved'),
  ('advokat1@lexnord.test', 'member', 'approved'),
  ('advokat2@lexnord.test', 'member', 'approved'),
  ('assistent@lexnord.test', 'member', 'approved')
) as member_role(email, role, status) on lower(u.primary_email) = member_role.email
on conflict (user_id, organization_id) do update
  set role = excluded.role,
      status = excluded.status,
      updated_at = now();

-- 4. Seed første sak
with org as (
  select id from public.organizations where orgnr = '920123456' limit 1
)
insert into public.cases (id, organization_id, title, client_name, status, metadata)
values (
  coalesce(
    (select id from public.cases where title = 'Acme v. Beta (LexNord seed)' limit 1),
    gen_random_uuid()
  ),
  (select id from org),
  'Acme v. Beta (LexNord seed)',
  'Acme Industries',
  'pending_assignment',
  jsonb_build_object(
    'initiatives', 'OCG + informasjons-sperre',
    'notes', 'MVP seed case – tildel til advokat, attestér og sett klar status.'
  )
)
on conflict (title, organization_id) do update
  set client_name = excluded.client_name,
      status = excluded.status,
      metadata = excluded.metadata,
      updated_at = now();

commit;
