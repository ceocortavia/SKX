-- Minimal seed data for local development
-- Run with: npm run db:seed

-- Organization
INSERT INTO public.organizations (orgnr, name, homepage_domain, org_form, registered_at, status_text, raw_brreg_json)
SELECT '123456789','TestOrg AS','example.org','AS','2020-01-01','Active','{"seed":true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.organizations WHERE orgnr='123456789');

-- Users (clerk ids match test headers used in curl)
INSERT INTO public.users (clerk_user_id, primary_email, full_name, mfa_level)
SELECT 'user_a','a@example.com','Alice','none'
WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE clerk_user_id='user_a');

INSERT INTO public.users (clerk_user_id, primary_email, full_name, mfa_level)
SELECT 'user_b','b@example.com','Bob','none'
WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE clerk_user_id='user_b');

-- Membership: make user_a admin/approved in org
DO $$
DECLARE 
  org uuid; 
  ua uuid;
BEGIN
  SELECT id INTO org FROM public.organizations WHERE orgnr='123456789';
  SELECT id INTO ua FROM public.users WHERE clerk_user_id='user_a';

  -- Idempotent: delete existing membership for seed purposes
  DELETE FROM public.memberships WHERE organization_id=org AND user_id=ua;

  INSERT INTO public.memberships (organization_id, user_id, role, status)
  VALUES (org, ua, 'admin', 'approved');
END$$;

-- Show what we created
SELECT 'Seed complete' as status;
SELECT 'Organization:' as info, id, name FROM public.organizations WHERE orgnr='123456789';
SELECT 'Users:' as info, id, clerk_user_id, primary_email FROM public.users WHERE clerk_user_id IN ('user_a', 'user_b');
SELECT 'Memberships:' as info, user_id, organization_id, role, status FROM public.memberships m 
JOIN public.users u ON m.user_id = u.id 
WHERE u.clerk_user_id = 'user_a';
