alter table public.organizations
  add column if not exists tech_stack jsonb;

comment on column public.organizations.tech_stack is
  'A JSON object containing technologies identified on the organization''s website by Wappalyzer.';


