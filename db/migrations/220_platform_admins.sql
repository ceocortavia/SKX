-- 220_platform_admins.sql
-- Platform-level administrators who can manage memberships across organizations

create table if not exists public.platform_admins (
  user_id uuid primary key references public.users(id) on delete cascade,
  granted_by uuid references public.users(id),
  granted_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
alter table public.platform_admins force row level security;

drop policy if exists platform_admins_super on public.platform_admins;
create policy platform_admins_super
on public.platform_admins
for all
using (
  current_setting('request.platform_role', true) = 'super_admin'
)
with check (
  current_setting('request.platform_role', true) = 'super_admin'
);

-- Allow app role through RLS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_client') THEN
    CREATE ROLE app_client;
  END IF;
END$$;

grant select, insert, delete on public.platform_admins to app_client;
