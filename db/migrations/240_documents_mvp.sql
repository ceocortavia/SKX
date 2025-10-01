-- Documents MVP: spaces, files, file_acls, file_index(meta), audit, offboarding_runs
-- Assumes public.organizations and public.users already exist

create extension if not exists pgcrypto;

-- 1) Spaces
create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  type text not null check (type in ('personal','team','org','transition')),
  name text not null,
  owner_user_id uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists spaces_org_type_idx on public.spaces(org_id, type);

-- 2) Files
create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  owner_user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  mime text not null,
  bytes bigint not null check (bytes >= 0),
  storage_key text not null unique,
  labels jsonb not null default '[]'::jsonb,
  confidentiality text not null default 'internal',
  retention_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists files_org_space_idx on public.files(org_id, space_id);
create index if not exists files_labels_gin on public.files using gin(labels jsonb_path_ops);

-- 3) File ACLs
create table if not exists public.file_acls (
  file_id uuid not null references public.files(id) on delete cascade,
  subject_type text not null check (subject_type in ('user','team','role')),
  subject_id text not null,
  perm text not null check (perm in ('read','write','admin')),
  primary key(file_id, subject_type, subject_id)
);

create index if not exists file_acls_file_idx on public.file_acls(file_id);

-- 4) File index (metadata only; vectors stored externally for MVP)
create table if not exists public.file_index (
  file_id uuid not null references public.files(id) on delete cascade,
  chunk_id text not null,
  page int null,
  md jsonb not null default '{}'::jsonb,
  primary key(file_id, chunk_id)
);

-- 5) Audit
create table if not exists public.audit (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid null references public.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid null,
  ip text null,
  ua text null,
  at timestamptz not null default now()
);

create index if not exists audit_org_time_idx on public.audit(org_id, at desc);

-- 6) Offboarding runs
create table if not exists public.offboarding_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  started_by uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending',
  result jsonb null,
  created_at timestamptz not null default now()
);

-- 7) RLS (org scoping for MVP). Policies can be tightened later to include ACL semantics.
alter table public.spaces enable row level security;
alter table public.files enable row level security;
alter table public.file_acls enable row level security;
alter table public.file_index enable row level security;
alter table public.audit enable row level security;
alter table public.offboarding_runs enable row level security;

-- Helper: current org from GUC
create or replace function public.current_org_id() returns uuid language sql stable as $$
  select nullif(current_setting('request.org_id', true), '')::uuid
$$;

-- Spaces RLS
drop policy if exists spaces_org_rls on public.spaces;
create policy spaces_org_rls on public.spaces using (org_id = public.current_org_id());

-- Files RLS
drop policy if exists files_org_rls on public.files;
create policy files_org_rls on public.files using (org_id = public.current_org_id());

-- File ACLs RLS (join via file)
drop policy if exists file_acls_org_rls on public.file_acls;
create policy file_acls_org_rls on public.file_acls using (
  exists (
    select 1 from public.files f where f.id = file_id and f.org_id = public.current_org_id()
  )
);

-- File index RLS (join via file)
drop policy if exists file_index_org_rls on public.file_index;
create policy file_index_org_rls on public.file_index using (
  exists (
    select 1 from public.files f where f.id = file_id and f.org_id = public.current_org_id()
  )
);

-- Audit RLS
drop policy if exists audit_org_rls on public.audit;
create policy audit_org_rls on public.audit using (org_id = public.current_org_id());

-- Offboarding runs RLS
drop policy if exists offboarding_org_rls on public.offboarding_runs;
create policy offboarding_org_rls on public.offboarding_runs using (org_id = public.current_org_id());

-- triggers
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;$$;

drop trigger if exists files_touch_updated_at on public.files;
create trigger files_touch_updated_at before update on public.files
for each row execute procedure public.touch_updated_at();










