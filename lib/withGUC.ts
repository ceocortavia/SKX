import type { PoolClient } from "pg";

/**
 * Runs `fn` in a tx where we SET LOCAL all request.* GUCs.
 * GUCs auto-reset at tx end. Safe + no global leakage.
 */
export async function withGUC<T>(
  client: PoolClient,
  gucs: Record<string, string | null | undefined>,
  fn: () => Promise<T>
): Promise<T> {
  // Only allow request.* keys and coerce null/undefined → ''
  const entries = Object.entries(gucs)
    .filter(([k]) => k.startsWith("request."))
    .map(([k, v]) => [k, v ?? ""] as [string, string]);

  // Development logging
  if (process.env.NODE_ENV !== 'production') {
    const guc = Object.fromEntries(entries);
    console.log('GUC:', {
      org_id: guc['request.org_id'],
      user_id: guc['request.user_id'],
      role: guc['request.org_role'],
      status: guc['request.org_status'],
      mfa: guc['request.mfa'],
      platform_role: guc['request.platform_role'],
    });
  }

  await client.query("BEGIN");
  try {
    // Use set_config($1,$2,true) so values are LOCAL to the tx
    for (const [k, v] of entries) {
      await client.query(`select set_config($1,$2,true)`, [k, v]);
    }
    const out = await fn();
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  }
}
