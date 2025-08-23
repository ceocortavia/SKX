-- 119_create_organization_domains.sql

create extension if not exists pgcrypto;

create table if not exists public.organization_domains (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  domain text not null,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists organization_domains_org_domain_key
  on public.organization_domains (organization_id, domain);

-- optional updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;$$;

drop trigger if exists tg_org_domains_set_updated_at on public.organization_domains;
create trigger tg_org_domains_set_updated_at
before update on public.organization_domains
for each row execute function public.set_updated_at();
