-- 221_platform_admin_policies.sql
-- Extend RLS policies to recognize platform-level administrators via request.platform_role

-- Users policies
DROP POLICY IF EXISTS users_select_self ON public.users;
CREATE POLICY users_select_self
ON public.users
FOR SELECT
USING (
  clerk_user_id = current_setting('request.clerk_user_id', true)
  OR current_setting('request.platform_role', true) = 'super_admin'
);

DROP POLICY IF EXISTS users_update_self_safe ON public.users;
CREATE POLICY users_update_self_safe
ON public.users
FOR UPDATE
USING (
  clerk_user_id = current_setting('request.clerk_user_id', true)
  OR current_setting('request.platform_role', true) = 'super_admin'
)
WITH CHECK (
  (clerk_user_id = current_setting('request.clerk_user_id', true)
    AND NOT (mfa_level IS DISTINCT FROM (SELECT u2.mfa_level FROM public.users u2 WHERE u2.id = public.users.id)))
  OR current_setting('request.platform_role', true) = 'super_admin'
);

-- Organizations policies
DROP POLICY IF EXISTS orgs_select_approved_context ON public.organizations;
CREATE POLICY orgs_select_approved_context
ON public.organizations
FOR SELECT
USING (
  (id = nullif(current_setting('request.org_id', true), '')::uuid
    AND current_setting('request.org_status', true) = 'approved')
  OR current_setting('request.platform_role', true) = 'super_admin'
);

DROP POLICY IF EXISTS orgs_update_admin_mfa ON public.organizations;
CREATE POLICY orgs_update_admin_mfa
ON public.organizations
FOR UPDATE
USING (
  (id = nullif(current_setting('request.org_id', true), '')::uuid
    AND current_setting('request.org_status', true) = 'approved'
    AND current_setting('request.org_role', true) IN ('admin','owner'))
  OR current_setting('request.platform_role', true) = 'super_admin'
)
WITH CHECK (
  (
    id = nullif(current_setting('request.org_id', true), '')::uuid
    AND current_setting('request.org_status', true) = 'approved'
    AND current_setting('request.org_role', true) IN ('admin','owner')
    AND coalesce(current_setting('request.mfa', true),'off') = 'on'
    AND orgnr          IS NOT DISTINCT FROM (SELECT o2.orgnr         FROM public.organizations o2 WHERE o2.id = public.organizations.id)
    AND name           IS NOT DISTINCT FROM (SELECT o2.name          FROM public.organizations o2 WHERE o2.id = public.organizations.id)
    AND org_form       IS NOT DISTINCT FROM (SELECT o2.org_form      FROM public.organizations o2 WHERE o2.id = public.organizations.id)
    AND registered_at  IS NOT DISTINCT FROM (SELECT o2.registered_at FROM public.organizations o2 WHERE o2.id = public.organizations.id)
    AND status_text    IS NOT DISTINCT FROM (SELECT o2.status_text   FROM public.organizations o2 WHERE o2.id = public.organizations.id)
    AND raw_brreg_json IS NOT DISTINCT FROM (SELECT o2.raw_brreg_json FROM public.organizations o2 WHERE o2.id = public.organizations.id)
  )
  OR current_setting('request.platform_role', true) = 'super_admin'
);

-- Membership policies
DROP POLICY IF EXISTS ms_select_self ON public.memberships;
CREATE POLICY ms_select_self
ON public.memberships
FOR SELECT
USING (
  user_id = nullif(current_setting('request.user_id', true), '')::uuid
  OR current_setting('request.platform_role', true) = 'super_admin'
);

DROP POLICY IF EXISTS ms_select_org_admin ON public.memberships;
CREATE POLICY ms_select_org_admin
ON public.memberships
FOR SELECT
USING (
  (
    organization_id = nullif(current_setting('request.org_id', true), '')::uuid
    AND current_setting('request.org_status', true) = 'approved'
    AND current_setting('request.org_role', true) IN ('admin','owner')
  )
  OR current_setting('request.platform_role', true) = 'super_admin'
);

DROP POLICY IF EXISTS ms_update_admin_mfa ON public.memberships;
CREATE POLICY ms_update_admin_mfa
ON public.memberships
FOR UPDATE
USING (
  (
    organization_id = nullif(current_setting('request.org_id', true), '')::uuid
    AND current_setting('request.org_status', true) = 'approved'
    AND current_setting('request.org_role', true) IN ('admin','owner')
    AND coalesce(current_setting('request.mfa', true),'off') = 'on'
  )
  OR current_setting('request.platform_role', true) = 'super_admin'
)
WITH CHECK (
  (
    organization_id = nullif(current_setting('request.org_id', true), '')::uuid
    AND current_setting('request.org_status', true) = 'approved'
    AND current_setting('request.org_role', true) IN ('admin','owner')
    AND coalesce(current_setting('request.mfa', true),'off') = 'on'
  )
  OR current_setting('request.platform_role', true) = 'super_admin'
);

-- Invitations policies (read & update)
DROP POLICY IF EXISTS inv_select_org_admin ON public.invitations;
CREATE POLICY inv_select_org_admin
ON public.invitations
FOR SELECT
USING (
  (
    organization_id = nullif(current_setting('request.org_id', true), '')::uuid
    AND current_setting('request.org_status', true) = 'approved'
    AND current_setting('request.org_role', true) IN ('admin','owner')
  )
  OR ((email)::text = nullif(current_setting('request.clerk_user_email', true), ''))
  OR current_setting('request.platform_role', true) = 'super_admin'
);

DROP POLICY IF EXISTS inv_insert_admin_mfa ON public.invitations;
CREATE POLICY inv_insert_admin_mfa
ON public.invitations
FOR INSERT
WITH CHECK (
  (
    organization_id = nullif(current_setting('request.org_id', true), '')::uuid
    AND current_setting('request.org_status', true) = 'approved'
    AND current_setting('request.org_role', true) IN ('admin','owner')
    AND coalesce(current_setting('request.mfa', true),'off') = 'on'
  )
  OR current_setting('request.platform_role', true) = 'super_admin'
);

DROP POLICY IF EXISTS inv_update_admin_mfa_revoke ON public.invitations;
CREATE POLICY inv_update_admin_mfa_revoke
ON public.invitations
FOR UPDATE
USING (
  (
    organization_id = nullif(current_setting('request.org_id', true), '')::uuid
    AND current_setting('request.org_status', true) = 'approved'
    AND current_setting('request.org_role', true) IN ('admin','owner')
    AND coalesce(current_setting('request.mfa', true),'off') = 'on'
  )
  OR current_setting('request.platform_role', true) = 'super_admin'
)
WITH CHECK (
  (
    organization_id = nullif(current_setting('request.org_id', true), '')::uuid
    AND current_setting('request.org_status', true) = 'approved'
    AND current_setting('request.org_role', true) IN ('admin','owner')
    AND coalesce(current_setting('request.mfa', true),'off') = 'on'
    AND status IN ('pending','revoked')
  )
  OR current_setting('request.platform_role', true) = 'super_admin'
);

-- Audit events select policy
DROP POLICY IF EXISTS ae_select_org_admin ON public.audit_events;
CREATE POLICY ae_select_org_admin
ON public.audit_events
FOR SELECT
USING (
  (
    actor_org_id = nullif(current_setting('request.org_id', true), '')::uuid
    AND current_setting('request.org_status', true) = 'approved'
    AND current_setting('request.org_role', true) IN ('admin','owner')
  )
  OR current_setting('request.platform_role', true) = 'super_admin'
);
