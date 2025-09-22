alter table public.organizations
  add column if not exists homepage_domain text;

create index if not exists organizations_homepage_domain_idx
  on public.organizations (homepage_domain);


