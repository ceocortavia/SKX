-- Fjern trigger-basert blokkering og håndhev via WITH CHECK slik at UPDATE gir 0 rader i stedet for exception
drop trigger if exists trg_users_prevent_mfa_update on public.users;
drop function if exists app.prevent_users_mfa_update();

-- Reetabler update-policy med eksplisitt WITH CHECK
drop policy if exists users_update_self_safe on public.users;
create policy users_update_self_safe
on public.users
for update
using ( app.is_self(id) )
with check (
  app.is_self(id)
  and mfa_level = (select u2.mfa_level from public.users u2 where u2.id = public.users.id)
);

