-- BRREG cache-tabell og helper

create extension if not exists pg_trgm;

create table if not exists public.brreg_cache (
  orgnr          text primary key check (orgnr ~ '^\d{9}$'),
  name           text not null,
  short_name     text,
  municipality   text,
  sector_code    text,
  industry_code  text,
  status         text,
  updated_at     timestamptz not null default now()
);

create index if not exists brreg_cache_name_trgm on public.brreg_cache using gin (name gin_trgm_ops);

-- Helper-funksjon for upsert
create or replace function public.upsert_brreg_cache(
  p_orgnr text,
  p_name text,
  p_short_name text,
  p_municipality text,
  p_sector_code text,
  p_industry_code text,
  p_status text
) returns public.brreg_cache
language plpgsql
as $$
declare
  result public.brreg_cache;
begin
  insert into public.brreg_cache (orgnr, name, short_name, municipality, sector_code, industry_code, status)
  values (p_orgnr, p_name, p_short_name, p_municipality, p_sector_code, p_industry_code, p_status)
  on conflict (orgnr) do update
    set name = excluded.name,
        short_name = excluded.short_name,
        municipality = excluded.municipality,
        sector_code = excluded.sector_code,
        industry_code = excluded.industry_code,
        status = excluded.status,
        updated_at = now()
  returning * into strict result;
  return result;
end$$;

create or replace view public.brreg_search as
select orgnr, name, short_name, status from public.brreg_cache;


