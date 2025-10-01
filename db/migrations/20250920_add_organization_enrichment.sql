-- Utvid organizations med berikede felter

alter table public.organizations
  add column if not exists industry_code text,
  add column if not exists address       text,
  add column if not exists ceo_name      text,
  add column if not exists revenue       numeric;

















