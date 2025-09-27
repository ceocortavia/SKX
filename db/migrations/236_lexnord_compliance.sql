-- 236_lexnord_compliance.sql
-- Policies, acknowledgements, case assignments og lisenser for LexNord MVP

create table if not exists public.policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, key)
);

drop trigger if exists tg_policies_updated on public.policies;
create trigger tg_policies_updated
before update on public.policies
for each row
execute function public.set_updated_at();

create table if not exists public.policy_versions (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.policies(id) on delete cascade,
  version integer not null,
  body_md text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (policy_id, version)
);

drop trigger if exists tg_policy_versions_updated on public.policy_versions;
create trigger tg_policy_versions_updated
before update on public.policy_versions
for each row execute function public.set_updated_at();

create table if not exists public.policy_ack (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  policy_version_id uuid not null references public.policy_versions(id) on delete cascade,
  context jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id, policy_version_id)
);

create table if not exists public.case_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unique (organization_id, case_id, user_id)
);

create table if not exists public.case_requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  requirement_key text not null,
  policy_version_id uuid references public.policy_versions(id),
  created_at timestamptz not null default now(),
  unique (organization_id, case_id, requirement_key, policy_version_id)
);

create table if not exists public.person_licenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  jurisdiction text not null,
  license_id text,
  expires_on date,
  status text not null default 'active',
  doc_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, jurisdiction)
);

drop trigger if exists tg_person_licenses_updated on public.person_licenses;
create trigger tg_person_licenses_updated
before update on public.person_licenses
for each row execute function public.set_updated_at();

-- RLS policies ---------------------------------------------------------------

alter table public.policies enable row level security;
alter table public.policies force row level security;
create policy policies_select_org_member on public.policies
  for select using (
    organization_id = nullif(current_setting('request.org_id', true), '')::uuid
    and current_setting('request.org_status', true) = 'approved'
  );
create policy policies_write_admin on public.policies
  for all using (
    organization_id = nullif(current_setting('request.org_id', true), '')::uuid
    and current_setting('request.org_role', true) = any(array['admin','owner'])
  )
  with check (
    organization_id = nullif(current_setting('request.org_id', true), '')::uuid
    and current_setting('request.org_role', true) = any(array['admin','owner'])
  );

alter table public.policy_versions enable row level security;
alter table public.policy_versions force row level security;
create policy policy_versions_select_org_member on public.policy_versions
  for select using (
    exists (
      select 1 from public.policies p
      where p.id = policy_versions.policy_id
        and p.organization_id = nullif(current_setting('request.org_id', true), '')::uuid
        and current_setting('request.org_status', true) = 'approved'
    )
  );
create policy policy_versions_insert_admin on public.policy_versions
  for insert with check (
    exists (
      select 1 from public.policies p
      where p.id = policy_versions.policy_id
        and p.organization_id = nullif(current_setting('request.org_id', true), '')::uuid
        and current_setting('request.org_role', true) = any(array['admin','owner'])
    )
  );

alter table public.policy_ack enable row level security;
alter table public.policy_ack force row level security;
create policy policy_ack_select_self_or_admin on public.policy_ack
  for select using (
    organization_id = nullif(current_setting('request.org_id', true), '')::uuid
    and (
      user_id = nullif(current_setting('request.user_id', true), '')::uuid
      or current_setting('request.org_role', true) = any(array['admin','owner'])
    )
  );
create policy policy_ack_insert_self on public.policy_ack
  for insert with check (
    organization_id = nullif(current_setting('request.org_id', true), '')::uuid
    and user_id = nullif(current_setting('request.user_id', true), '')::uuid
  );

alter table public.case_assignments enable row level security;
alter table public.case_assignments force row level security;
create policy case_assignments_select_org_member on public.case_assignments
  for select using (
    organization_id = nullif(current_setting('request.org_id', true), '')::uuid
    and current_setting('request.org_status', true) = 'approved'
  );
create policy case_assignments_insert_admin on public.case_assignments
  for insert with check (
    organization_id = nullif(current_setting('request.org_id', true), '')::uuid
    and current_setting('request.org_role', true) = any(array['admin','owner'])
  );
create policy case_assignments_delete_admin on public.case_assignments
  for delete using (
    organization_id = nullif(current_setting('request.org_id', true), '')::uuid
    and current_setting('request.org_role', true) = any(array['admin','owner'])
  );

alter table public.case_requirements enable row level security;
alter table public.case_requirements force row level security;
create policy case_requirements_select_org_member on public.case_requirements
  for select using (
    organization_id = nullif(current_setting('request.org_id', true), '')::uuid
    and current_setting('request.org_status', true) = 'approved'
  );
create policy case_requirements_write_admin on public.case_requirements
  for all using (
    organization_id = nullif(current_setting('request.org_id', true), '')::uuid
    and current_setting('request.org_role', true) = any(array['admin','owner'])
  )
  with check (
    organization_id = nullif(current_setting('request.org_id', true), '')::uuid
    and current_setting('request.org_role', true) = any(array['admin','owner'])
  );

alter table public.person_licenses enable row level security;
alter table public.person_licenses force row level security;
create policy person_licenses_select_org_member on public.person_licenses
  for select using (
    organization_id = nullif(current_setting('request.org_id', true), '')::uuid
    and current_setting('request.org_status', true) = 'approved'
  );
create policy person_licenses_write_admin on public.person_licenses
  for all using (
    organization_id = nullif(current_setting('request.org_id', true), '')::uuid
    and current_setting('request.org_role', true) = any(array['admin','owner'])
  )
  with check (
    organization_id = nullif(current_setting('request.org_id', true), '')::uuid
    and current_setting('request.org_role', true) = any(array['admin','owner'])
  );

