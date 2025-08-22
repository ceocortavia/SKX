-- RLS policies for users using app.* request context helpers
-- Forutsetter at 001_extensions_and_helpers.sql er kjørt (app.set_request_context, app.current_user_id, app.mfa_on)

-- Sikker helper: er dette min egen rad?
create or replace function app.is_self(u_id uuid)
returns boolean language sql stable as $$
  select app.current_user_id() is not null and app.current_user_id() = u_id;
$$;

-- Forsikre at RLS er aktiv og tvunget
alter table public.users enable row level security;
alter table public.users force  row level security;

-- Policy 1: Egen SELECT (alle statuser kan lese sin egen profil)
drop policy if exists users_select_self on public.users;
create policy users_select_self
on public.users
for select
using ( app.is_self(id) );

-- Policy 2: UPDATE egen rad, men IKKE sikkerhetsfelt
-- Vi tillater endring av ufarlige felter (full_name osv.),
-- men mfa_level må være unverändert i UPDATE.
drop policy if exists users_update_self_safe on public.users;
create policy users_update_self_safe
on public.users
for update
using ( app.is_self(id) )
with check ( app.is_self(id) );

-- Trigger for å blokkere endring av mfa_level fra klient
create or replace function app.prevent_users_mfa_update()
returns trigger language plpgsql as $$
begin
  if NEW.mfa_level is distinct from OLD.mfa_level then
    raise exception 'Updating mfa_level is not allowed';
  end if;
  return NEW;
end;$$;

drop trigger if exists trg_users_prevent_mfa_update on public.users;
create trigger trg_users_prevent_mfa_update
before update of mfa_level on public.users
for each row
execute function app.prevent_users_mfa_update();

-- Ingen INSERT/DELETE policies for users fra klient.
-- Opprettelse/sletting håndteres av server-rutiner senere.


