-- Ekstra berikede felter fra åpne kilder (Regnskapsregisteret, NAV Arbeidsplassen, Doffin)

alter table public.organizations
  add column if not exists revenue_latest                     numeric,
  add column if not exists revenue_latest_year                integer,
  add column if not exists profit_before_tax_latest           numeric,
  add column if not exists equity_latest                      numeric,
  add column if not exists job_postings_active                integer,
  add column if not exists job_postings_recent                integer,
  add column if not exists job_tech_tags                      text[],
  add column if not exists has_public_contracts               boolean,
  add column if not exists public_contracts_count             integer,
  add column if not exists public_contracts_sample            jsonb,
  add column if not exists enriched_at                        timestamptz;


