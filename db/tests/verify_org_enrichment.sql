-- Verifiser at nye kolonner finnes
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'organizations'
  and column_name in ('industry_code','address','ceo_name','revenue')
order by column_name;

-- Test-upsert av eksempeldata i de nye kolonnene
insert into public.organizations (orgnr, name, industry_code, address, ceo_name, revenue)
values ('999999999', 'Temp Org 999', '62.010', 'Storgata 1, 0001 Oslo', 'Ola Test', 123456789)
on conflict (orgnr) do update set
  name = excluded.name,
  industry_code = excluded.industry_code,
  address = excluded.address,
  ceo_name = excluded.ceo_name,
  revenue = excluded.revenue,
  updated_at = now()
returning id, orgnr, name, industry_code, address, ceo_name, revenue;

-- Les tilbake verdiene
select id, orgnr, name, industry_code, address, ceo_name, revenue
from public.organizations
where orgnr = '999999999';









