-- Audit indexes for cursor-based pagination
-- This enables efficient keyset pagination on audit_events table

CREATE INDEX IF NOT EXISTS idx_audit_org_created_id
ON public.audit_events (actor_org_id, created_at DESC, id DESC);

-- Also add a covering index for common queries
CREATE INDEX IF NOT EXISTS idx_audit_org_action_created
ON public.audit_events (actor_org_id, action, created_at DESC, id DESC);




