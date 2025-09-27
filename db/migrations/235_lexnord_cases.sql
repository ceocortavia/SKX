-- 235_lexnord_cases.sql
-- MVP struktur for LexNord-saker

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  client_name text,
  status text not null default 'pending_assignment',
  assigned_user_id uuid references public.users(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cases_org_status on public.cases (organization_id, status);
create index if not exists idx_cases_assigned on public.cases (assigned_user_id);

-- Audit-tabell for sakshendelser
create table if not exists public.case_audit (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  action text not null,
  actor_user_id uuid references public.users(id),
  notes jsonb,
  created_at timestamptz not null default now()
);

-- gjenbruk updated_at-trigger
drop trigger if exists tg_cases_set_updated_at on public.cases;
create trigger tg_cases_set_updated_at
before update on public.cases
for each row
execute function public.set_updated_at();

-- RLS for cases
alter table public.cases enable row level security;
alter table public.cases force row level security;

-- medlemmer i organisasjonen kan lese saker i approved org
create policy cases_select_org_member on public.cases
  for select using (
    organization_id = nullif(current_setting('request.org_id', true), '')::uuid
    and current_setting('request.org_status', true) = 'approved'
  );

-- admin/owner kan insert/update/delete; assigned advokat kan oppdatere
create policy cases_insert_admin on public.cases
  for insert with check (
    organization_id = nullif(current_setting('request.org_id', true), '')::uuid
    and current_setting('request.org_status', true) = 'approved'
    and current_setting('request.org_role', true) = any(array['admin','owner'])
  );

create policy cases_update_admin_or_assigned on public.cases
  for update using (
    organization_id = nullif(current_setting('request.org_id', true), '')::uuid
    and current_setting('request.org_status', true) = 'approved'
    and (
      current_setting('request.org_role', true) = any(array['admin','owner'])
      or assigned_user_id = nullif(current_setting('request.user_id', true), '')::uuid
    )
  )
  with check (
    organization_id = nullif(current_setting('request.org_id', true), '')::uuid
    and current_setting('request.org_status', true) = 'approved'
    and (
      current_setting('request.org_role', true) = any(array['admin','owner'])
      or assigned_user_id = nullif(current_setting('request.user_id', true), '')::uuid
    )
  );

create policy cases_delete_admin on public.cases
  for delete using (
    organization_id = nullif(current_setting('request.org_id', true), '')::uuid
    and current_setting('request.org_role', true) = any(array['admin','owner'])
  );

-- RLS for case_audit: alle i org kan lese, admin/assigned kan skrive
alter table public.case_audit enable row level security;
alter table public.case_audit force row level security;

create policy case_audit_select_org_member on public.case_audit
  for select using (
    exists (
      select 1
      from public.cases c
      where c.id = case_audit.case_id
        and c.organization_id = nullif(current_setting('request.org_id', true), '')::uuid
    )
    and current_setting('request.org_status', true) = 'approved'
  );

create policy case_audit_insert_admin_or_assigned on public.case_audit
  for insert with check (
    exists (
      select 1
      from public.cases c
      where c.id = case_audit.case_id
        and c.organization_id = nullif(current_setting('request.org_id', true), '')::uuid
        and current_setting('request.org_status', true) = 'approved'
        and (
          current_setting('request.org_role', true) = any(array['admin','owner'])
          or c.assigned_user_id = nullif(current_setting('request.user_id', true), '')::uuid
        )
    )
  );

create policy case_audit_delete_admin on public.case_audit
  for delete using (
    current_setting('request.org_role', true) = any(array['admin','owner'])
  );
