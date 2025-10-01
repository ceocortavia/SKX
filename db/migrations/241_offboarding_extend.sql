-- Extend offboarding runs with richer state tracking for documents MVP

alter table public.offboarding_runs
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists candidate_files uuid[] not null default '{}'::uuid[],
  add column if not exists transition_space_id uuid null references public.spaces(id) on delete set null,
  add column if not exists artifacts jsonb not null default '{}'::jsonb;

-- Align default status with new workflow
alter table public.offboarding_runs
  alter column status set default 'processing';

-- Backfill updated_at to created_at for existing rows (if any)
update public.offboarding_runs set updated_at = coalesce(updated_at, created_at);

create index if not exists offboarding_runs_org_status_idx
  on public.offboarding_runs (org_id, status);

-- Touch trigger keeps updated_at current
create or replace function public.offboarding_runs_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists offboarding_runs_touch_updated_at on public.offboarding_runs;
create trigger offboarding_runs_touch_updated_at
before update on public.offboarding_runs
for each row execute procedure public.offboarding_runs_touch_updated_at();
