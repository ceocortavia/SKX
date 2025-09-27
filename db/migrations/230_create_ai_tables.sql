-- 230_create_ai_tables.sql
-- Tier 1 AI support tables + enums

create extension if not exists pgcrypto;

-- Feature enum covering all tier 1 capabilities
create type ai_feature as enum (
  'BRREG_SUGGEST',
  'INVITE_COPY',
  'CSV_MAP',
  'COPILOT_QA'
);

-- Run lifecycle enum to track background execution
create type ai_run_status as enum ('QUEUED','RUNNING','SUCCESS','ERROR');

-- Template types kept minimal for now
create type content_template_type as enum ('INVITE');

-- CSV import workflow status
create type csv_import_status as enum ('DRAFT','VALIDATED','IMPORTED');

-- Knowledge base scope (global vs org-specific)
create type kb_scope as enum ('GLOBAL','ORG');

create table if not exists public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  feature ai_feature not null,
  input_hash text,
  status ai_run_status not null default 'QUEUED',
  latency_ms integer,
  tokens_in integer,
  tokens_out integer,
  model_version text,
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  error_text text,
  unique (org_id, feature, input_hash, status)
);

create index if not exists idx_ai_runs_org on public.ai_runs (org_id, created_at desc);
create index if not exists idx_ai_runs_feature on public.ai_runs (feature);

create table if not exists public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  feature ai_feature not null,
  run_id uuid references public.ai_runs(id) on delete set null,
  target_table text not null,
  target_id uuid,
  diff_json jsonb not null,
  confidence numeric(5,4),
  reasoning text,
  etag text not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  applied_by uuid references public.users(id) on delete set null,
  applied_at timestamptz,
  unique (org_id, feature, etag)
);

create index if not exists idx_ai_suggestions_org on public.ai_suggestions (org_id, created_at desc);
create index if not exists idx_ai_suggestions_target on public.ai_suggestions (target_table, target_id);

create table if not exists public.content_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  type content_template_type not null,
  locale text not null,
  subject text not null,
  body text not null,
  meta_json jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (org_id, type, locale, subject)
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;$$;

drop trigger if exists tg_content_templates_updated on public.content_templates;
create trigger tg_content_templates_updated
before update on public.content_templates
for each row execute function public.set_updated_at();

create table if not exists public.csv_import_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  file_name text,
  mapping_json jsonb,
  issues_json jsonb,
  sample_json jsonb,
  status csv_import_status not null default 'DRAFT',
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

drop trigger if exists tg_csv_import_sessions_updated on public.csv_import_sessions;
create trigger tg_csv_import_sessions_updated
before update on public.csv_import_sessions
for each row execute function public.set_updated_at();

create index if not exists idx_csv_sessions_org on public.csv_import_sessions (org_id, created_at desc);

create table if not exists public.kb_docs (
  id uuid primary key default gen_random_uuid(),
  scope kb_scope not null,
  org_id uuid references public.organizations(id) on delete cascade,
  title text not null,
  source text,
  content text,
  embedding_vector double precision[],
  updated_at timestamptz not null default now()
);

create index if not exists idx_kb_docs_scope on public.kb_docs (scope);
create index if not exists idx_kb_docs_org on public.kb_docs (org_id);
