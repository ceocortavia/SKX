-- Bytt RLS-policies til å bruke GUC 'request.clerk_user_id' istedenfor app.is_self(id)

-- Sikre RLS på
alter table public.users enable row level security;
alter table public.users force  row level security;

-- Slipp gamle policies
drop policy if exists users_select_self on public.users;
drop policy if exists users_update_self_safe on public.users;

-- Ny SELECT-policy: bruker ser kun egen rad basert på clerk_user_id
create policy users_select_self
on public.users
for select
using (
  clerk_user_id = current_setting('request.clerk_user_id', true)
);

-- Ny UPDATE-policy: bruker kan oppdatere egen rad, men ikke mfa_level
create policy users_update_self_safe
on public.users
for update
using (
  clerk_user_id = current_setting('request.clerk_user_id', true)
)
with check (
  clerk_user_id = current_setting('request.clerk_user_id', true)
  and mfa_level is not distinct from (select u2.mfa_level from public.users u2 where u2.id = public.users.id)
);

