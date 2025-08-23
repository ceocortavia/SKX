-- Ensure extensions you might need
create extension if not exists pgcrypto;

-- 1) App schema for helpers
create schema if not exists app;

-- 2) Request context using GUC-backed settings
-- We store context in current session via set_config/get_setting
-- Helpers expect these keys:
--   request.user_id (uuid or null)
--   request.mfa_on (boolean text 'true'/'false')

create or replace function app.set_request_context(p_user_id uuid, p_role text, p_mfa_on boolean)
returns void language plpgsql as $$
begin
  -- Bruk session-scope (is_local=false) slik at verdiene lever videre mellom statements
  perform set_config('request.user_id', coalesce(p_user_id::text, ''), false);
  perform set_config('request.mfa_on', case when p_mfa_on then 'true' else 'false' end, false);
end;$$;

create or replace function app.current_user_id()
returns uuid language sql stable as $$
  select nullif(current_setting('request.user_id', true), '')::uuid;
$$;

create or replace function app.mfa_on()
returns boolean language sql stable as $$
  select coalesce(current_setting('request.mfa_on', true), 'false') = 'true';
$$;
