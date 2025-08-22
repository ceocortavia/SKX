-- Helper: set context by clerk_user_id (SECURITY DEFINER to bypass RLS for lookup)
create or replace function app.set_context_by_clerk_user_id(p_clerk_id text, p_mfa_on boolean default false)
returns void
language plpgsql
security definer
set search_path = public, app
as $$
declare
  u_id uuid;
begin
  select id into u_id from public.users where clerk_user_id = p_clerk_id;
  perform app.set_request_context(u_id, null, coalesce(p_mfa_on, false));
end;$$;

