-- 010_base_schema.sql
-- Grunnskjema for tabeller og typer som andre migrasjoner/policies avhenger av

-- Utvidelser
create extension if not exists pgcrypto;

-- Enums
do $$ begin
  if not exists (select 1 from pg_type where typname = 'member_role') then
    create type member_role as enum ('owner','admin','member');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'membership_status') then
    create type membership_status as enum ('approved','pending');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'invitation_status') then
    create type invitation_status as enum ('pending','accepted','revoked');
  end if;
end $$;

-- Tabeller
create table if not exists public.users (
  id              uuid primary key default gen_random_uuid(),
  clerk_user_id   text unique not null,
  primary_email   text,
  full_name       text,
  mfa_level       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.organizations (
  id               uuid primary key default gen_random_uuid(),
  orgnr            text unique,
  name             text,
  homepage_domain  text,
  org_form         text,
  registered_at    timestamptz,
  status_text      text,
  raw_brreg_json   jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Medlemskap: kompositt PK for (user_id, organization_id)
create table if not exists public.memberships (
  user_id         uuid not null references public.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role            member_role not null default 'member',
  status          membership_status not null default 'pending',
  approved_by     uuid references public.users(id),
  approved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (user_id, organization_id)
);

-- Invitasjoner
create table if not exists public.invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email           text not null,
  requested_role  member_role not null default 'member',
  status          invitation_status not null default 'pending',
  expires_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Audit events (append-only)
create table if not exists public.audit_events (
  id             uuid primary key default gen_random_uuid(),
  actor_user_id  uuid references public.users(id),
  actor_org_id   uuid references public.organizations(id),
  action         text not null,
  target_table   text,
  target_pk      uuid,
  metadata       jsonb,
  created_at     timestamptz not null default now()
);

-- Generisk updated_at-trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;$$;

-- Triggere for updated_at der det finnes feltet
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='users' and column_name='updated_at') then
    drop trigger if exists tg_users_set_updated_at on public.users;
    create trigger tg_users_set_updated_at before update on public.users for each row execute function public.set_updated_at();
  end if;
end $$;

do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='organizations' and column_name='updated_at') then
    drop trigger if exists tg_orgs_set_updated_at on public.organizations;
    create trigger tg_orgs_set_updated_at before update on public.organizations for each row execute function public.set_updated_at();
  end if;
end $$;

do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='memberships' and column_name='updated_at') then
    drop trigger if exists tg_memberships_set_updated_at on public.memberships;
    create trigger tg_memberships_set_updated_at before update on public.memberships for each row execute function public.set_updated_at();
  end if;
end $$;

do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='invitations' and column_name='updated_at') then
    drop trigger if exists tg_invitations_set_updated_at on public.invitations;
    create trigger tg_invitations_set_updated_at before update on public.invitations for each row execute function public.set_updated_at();
  end if;
end $$;



