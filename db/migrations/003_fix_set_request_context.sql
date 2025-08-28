-- Update set_request_context to use session-scope (is_local=false)
create or replace function app.set_request_context(p_user_id uuid, p_role text, p_mfa_on boolean)
returns void language plpgsql as $$
begin
  perform set_config('request.user_id', coalesce(p_user_id::text, ''), false);
  perform set_config('request.mfa_on', case when p_mfa_on then 'true' else 'false' end, false);
end;$$;

