import type { PoolClient } from "pg";

export async function resolveOrgContext(
  client: PoolClient,
  params: { userId: string; hintedOrgId?: string | null }
): Promise<{ orgId?: string; orgRole?: "owner" | "admin" | "member"; orgStatus?: "approved" | "pending" | "blocked" }> {
  const { userId, hintedOrgId } = params;

  if (hintedOrgId) {
    const { rows } = await client.query(
      `select role, status from public.memberships where user_id = $1 and organization_id = $2 limit 1`,
      [userId, hintedOrgId]
    );
    if (rows[0]) {
      return { orgId: hintedOrgId, orgRole: rows[0].role, orgStatus: rows[0].status };
    }
  }

  const { rows } = await client.query(
    `select m.organization_id as id, m.role, m.status
     from public.memberships m
     where m.user_id = $1
     order by (m.status='approved') desc, m.created_at asc
     limit 1`,
    [userId]
  );
  if (rows[0]) {
    return { orgId: rows[0].id, orgRole: rows[0].role, orgStatus: rows[0].status };
  }
  return {};
}


