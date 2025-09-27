-- 231_ai_tables_policies.sql
-- RLS rules for AI support tables

-- ai_runs
alter table public.ai_runs enable row level security;
alter table public.ai_runs force row level security;

drop policy if exists ai_runs_select_org_admin on public.ai_runs;
create policy ai_runs_select_org_admin on public.ai_runs
  for select using (
    (
      org_id = nullif(current_setting('request.org_id', true), '')::uuid
      and current_setting('request.org_status', true) = 'approved'
      and current_setting('request.org_role', true) = any(array['admin','owner'])
    )
    or current_setting('request.platform_role', true) = 'super_admin'
  );

drop policy if exists ai_runs_insert_admin_mfa on public.ai_runs;
create policy ai_runs_insert_admin_mfa on public.ai_runs
  for insert with check (
    (
      org_id = nullif(current_setting('request.org_id', true), '')::uuid
      and current_setting('request.org_status', true) = 'approved'
      and current_setting('request.org_role', true) = any(array['admin','owner'])
      and coalesce(current_setting('request.mfa', true), 'off') = 'on'
    )
    or current_setting('request.platform_role', true) = 'super_admin'
  );

drop policy if exists ai_runs_update_admin_mfa on public.ai_runs;
create policy ai_runs_update_admin_mfa on public.ai_runs
  for update using (
    (
      org_id = nullif(current_setting('request.org_id', true), '')::uuid
      and current_setting('request.org_status', true) = 'approved'
      and current_setting('request.org_role', true) = any(array['admin','owner'])
      and coalesce(current_setting('request.mfa', true), 'off') = 'on'
    )
    or current_setting('request.platform_role', true) = 'super_admin'
  )
  with check (
    (
      org_id = nullif(current_setting('request.org_id', true), '')::uuid
      and current_setting('request.org_status', true) = 'approved'
      and current_setting('request.org_role', true) = any(array['admin','owner'])
      and coalesce(current_setting('request.mfa', true), 'off') = 'on'
    )
    or current_setting('request.platform_role', true) = 'super_admin'
  );

-- ai_suggestions
alter table public.ai_suggestions enable row level security;
alter table public.ai_suggestions force row level security;

drop policy if exists ai_suggestions_select_org_admin on public.ai_suggestions;
create policy ai_suggestions_select_org_admin on public.ai_suggestions
  for select using (
    (
      org_id = nullif(current_setting('request.org_id', true), '')::uuid
      and current_setting('request.org_status', true) = 'approved'
      and current_setting('request.org_role', true) = any(array['admin','owner'])
    )
    or current_setting('request.platform_role', true) = 'super_admin'
  );

drop policy if exists ai_suggestions_insert_admin_mfa on public.ai_suggestions;
create policy ai_suggestions_insert_admin_mfa on public.ai_suggestions
  for insert with check (
    (
      org_id = nullif(current_setting('request.org_id', true), '')::uuid
      and current_setting('request.org_status', true) = 'approved'
      and current_setting('request.org_role', true) = any(array['admin','owner'])
      and coalesce(current_setting('request.mfa', true), 'off') = 'on'
    )
    or current_setting('request.platform_role', true) = 'super_admin'
  );

drop policy if exists ai_suggestions_update_admin_mfa on public.ai_suggestions;
create policy ai_suggestions_update_admin_mfa on public.ai_suggestions
  for update using (
    (
      org_id = nullif(current_setting('request.org_id', true), '')::uuid
      and current_setting('request.org_status', true) = 'approved'
      and current_setting('request.org_role', true) = any(array['admin','owner'])
      and coalesce(current_setting('request.mfa', true), 'off') = 'on'
    )
    or current_setting('request.platform_role', true) = 'super_admin'
  )
  with check (
    (
      org_id = nullif(current_setting('request.org_id', true), '')::uuid
      and current_setting('request.org_status', true) = 'approved'
      and current_setting('request.org_role', true) = any(array['admin','owner'])
      and coalesce(current_setting('request.mfa', true), 'off') = 'on'
    )
    or current_setting('request.platform_role', true) = 'super_admin'
  );

-- content_templates
alter table public.content_templates enable row level security;
alter table public.content_templates force row level security;

drop policy if exists content_templates_select_org on public.content_templates;
create policy content_templates_select_org on public.content_templates
  for select using (
    (
      org_id = nullif(current_setting('request.org_id', true), '')::uuid
      and current_setting('request.org_status', true) = 'approved'
    )
    or current_setting('request.platform_role', true) = 'super_admin'
  );

drop policy if exists content_templates_crud_admin_mfa on public.content_templates;
create policy content_templates_crud_admin_mfa on public.content_templates
  for all using (
    (
      org_id = nullif(current_setting('request.org_id', true), '')::uuid
      and current_setting('request.org_status', true) = 'approved'
      and current_setting('request.org_role', true) = any(array['admin','owner'])
      and coalesce(current_setting('request.mfa', true), 'off') = 'on'
    )
    or current_setting('request.platform_role', true) = 'super_admin'
  )
  with check (
    (
      org_id = nullif(current_setting('request.org_id', true), '')::uuid
      and current_setting('request.org_status', true) = 'approved'
      and current_setting('request.org_role', true) = any(array['admin','owner'])
      and coalesce(current_setting('request.mfa', true), 'off') = 'on'
    )
    or current_setting('request.platform_role', true) = 'super_admin'
  );

-- csv_import_sessions
alter table public.csv_import_sessions enable row level security;
alter table public.csv_import_sessions force row level security;

drop policy if exists csv_sessions_select_org on public.csv_import_sessions;
create policy csv_sessions_select_org on public.csv_import_sessions
  for select using (
    (
      org_id = nullif(current_setting('request.org_id', true), '')::uuid
      and current_setting('request.org_status', true) = 'approved'
    )
    or current_setting('request.platform_role', true) = 'super_admin'
  );

drop policy if exists csv_sessions_crud_admin_mfa on public.csv_import_sessions;
create policy csv_sessions_crud_admin_mfa on public.csv_import_sessions
  for all using (
    (
      org_id = nullif(current_setting('request.org_id', true), '')::uuid
      and current_setting('request.org_status', true) = 'approved'
      and current_setting('request.org_role', true) = any(array['admin','owner'])
      and coalesce(current_setting('request.mfa', true), 'off') = 'on'
    )
    or current_setting('request.platform_role', true) = 'super_admin'
  )
  with check (
    (
      org_id = nullif(current_setting('request.org_id', true), '')::uuid
      and current_setting('request.org_status', true) = 'approved'
      and current_setting('request.org_role', true) = any(array['admin','owner'])
      and coalesce(current_setting('request.mfa', true), 'off') = 'on'
    )
    or current_setting('request.platform_role', true) = 'super_admin'
  );

-- kb_docs
alter table public.kb_docs enable row level security;
alter table public.kb_docs force row level security;

drop policy if exists kb_docs_select_global on public.kb_docs;
create policy kb_docs_select_global on public.kb_docs
  for select using (
    (scope = 'GLOBAL')
    or current_setting('request.platform_role', true) = 'super_admin'
    or (
      scope = 'ORG'
      and org_id = nullif(current_setting('request.org_id', true), '')::uuid
      and current_setting('request.org_status', true) = 'approved'
    )
  );

drop policy if exists kb_docs_insert_org_admin on public.kb_docs;
create policy kb_docs_insert_org_admin on public.kb_docs
  for insert with check (
    (
      scope = 'ORG'
      and org_id = nullif(current_setting('request.org_id', true), '')::uuid
      and current_setting('request.org_status', true) = 'approved'
      and current_setting('request.org_role', true) = any(array['admin','owner'])
      and coalesce(current_setting('request.mfa', true), 'off') = 'on'
    )
    or (
      scope = 'GLOBAL'
      and current_setting('request.platform_role', true) = 'super_admin'
    )
  );

drop policy if exists kb_docs_update_scope_guard on public.kb_docs;
create policy kb_docs_update_scope_guard on public.kb_docs
  for update using (
    (
      scope = 'ORG'
      and org_id = nullif(current_setting('request.org_id', true), '')::uuid
      and current_setting('request.org_status', true) = 'approved'
      and current_setting('request.org_role', true) = any(array['admin','owner'])
      and coalesce(current_setting('request.mfa', true), 'off') = 'on'
    )
    or (
      scope = 'GLOBAL'
      and current_setting('request.platform_role', true) = 'super_admin'
    )
  )
  with check (
    (
      scope = 'ORG'
      and org_id = nullif(current_setting('request.org_id', true), '')::uuid
      and current_setting('request.org_status', true) = 'approved'
      and current_setting('request.org_role', true) = any(array['admin','owner'])
      and coalesce(current_setting('request.mfa', true), 'off') = 'on'
    )
    or (
      scope = 'GLOBAL'
      and current_setting('request.platform_role', true) = 'super_admin'
    )
  );

-- Delete only via same rules as update

drop policy if exists kb_docs_delete_scope_guard on public.kb_docs;
create policy kb_docs_delete_scope_guard on public.kb_docs
  for delete using (
    (
      scope = 'ORG'
      and org_id = nullif(current_setting('request.org_id', true), '')::uuid
      and current_setting('request.org_status', true) = 'approved'
      and current_setting('request.org_role', true) = any(array['admin','owner'])
      and coalesce(current_setting('request.mfa', true), 'off') = 'on'
    )
    or (
      scope = 'GLOBAL'
      and current_setting('request.platform_role', true) = 'super_admin'
    )
  );
