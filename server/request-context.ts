import type { PoolClient } from "pg";

interface RequestContextOptions {
  orgId?: string | null;
  userId?: string | null;
  role?: string | null;
  status?: string | null;
  mfa?: boolean | null;
  platformRole?: string | null;
}

/**
 * Apply the standard request.* GUC values for RLS-aware queries.
 */
export async function setRequestContext(client: PoolClient, options: RequestContextOptions): Promise<void> {
  const entries: Array<[string, string]> = [];

  if (options.orgId) entries.push(["request.org_id", options.orgId]);
  if (options.userId) entries.push(["request.user_id", options.userId]);
  if (options.role) entries.push(["request.org_role", options.role]);
  if (options.status) entries.push(["request.org_status", options.status]);
  if (options.platformRole) entries.push(["request.platform_role", options.platformRole]);
  if (options.mfa !== undefined && options.mfa !== null) {
    entries.push(["request.mfa", options.mfa ? "on" : "off"]);
  }

  for (const [key, value] of entries) {
    await client.query(`select set_config($1, $2, true)`, [key, value]);
  }
}
