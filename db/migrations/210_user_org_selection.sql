-- user_org_selection: valgt organisasjon per bruker
create table if not exists public.user_org_selection (
  user_id uuid primary key references public.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  orgnr text,
  org_name text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_org_selection_org on public.user_org_selection (organization_id);

alter table public.user_org_selection enable row level security;

drop policy if exists user_owns_row on public.user_org_selection;
create policy user_owns_row on public.user_org_selection
  using (user_id = nullif(current_setting('request.user_id', true),'')::uuid);

drop policy if exists user_owns_row_write_insert on public.user_org_selection;
create policy user_owns_row_write_insert on public.user_org_selection
  for insert with check (user_id = nullif(current_setting('request.user_id', true),'')::uuid);

drop policy if exists user_owns_row_write_update on public.user_org_selection;
create policy user_owns_row_write_update on public.user_org_selection
  for update using (user_id = nullif(current_setting('request.user_id', true),'')::uuid);


