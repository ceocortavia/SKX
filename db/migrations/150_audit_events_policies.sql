-- 150_audit_events_policies.sql

-- RLS på/force
alter table public.audit_events enable row level security;
alter table public.audit_events force  row level security;

-- SELECT-policy 1: admin/owner i approved org kan se orgens hendelser
drop policy if exists ae_select_org_admin on public.audit_events;
create policy ae_select_org_admin
on public.audit_events
for select
using (
  actor_org_id = nullif(current_setting('request.org_id', true), '')::uuid
  and current_setting('request.org_status', true) = 'approved'
  and current_setting('request.org_role',   true) in ('admin','owner')
);

-- SELECT-policy 2: bruker kan se egne hendelser
drop policy if exists ae_select_self on public.audit_events;
create policy ae_select_self
on public.audit_events
for select
using (
  actor_user_id = nullif(current_setting('request.user_id', true), '')::uuid
);

-- Append-only guard: blokker UPDATE/DELETE eksplisitt
create or replace function app.guard_audit_events_append_only()
returns trigger language plpgsql as $$
begin
  if tg_op in ('UPDATE','DELETE') then
    raise exception 'audit_events is append-only (no % allowed)', tg_op;
  end if;
  return coalesce(new, old);
end$$;

drop trigger if exists tg_audit_events_append_only on public.audit_events;
create trigger tg_audit_events_append_only
before update or delete on public.audit_events
for each row execute function app.guard_audit_events_append_only();

-- Privilegier for RLS-klient: kun SELECT
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app_client') then
    create role app_client;
  end if;
end $$;

revoke all on public.audit_events from app_client;
grant select on public.audit_events to app_client;
