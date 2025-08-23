import type { PoolClient } from "pg";
import { pool } from "./db";

export type RlsContext = {
  userId?: string;
  clerkUserId?: string;
  clerkUserEmail?: string;
  orgId?: string;
  orgRole?: "owner" | "admin" | "member";
  orgStatus?: "approved" | "pending" | "blocked";
  mfa?: "on" | "off";
};

export async function withGUC<T>(
  ctx: RlsContext,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const sets: Array<[string, string | null]> = [
      ["request.user_id", ctx.userId ?? null],
      ["request.clerk_user_id", ctx.clerkUserId ?? null],
      ["request.clerk_user_email", ctx.clerkUserEmail ?? null],
      ["request.org_id", ctx.orgId ?? null],
      ["request.org_role", ctx.orgRole ?? null],
      ["request.org_status", ctx.orgStatus ?? null],
      ["request.mfa", ctx.mfa ?? "off"],
    ];

    for (const [k, v] of sets) {
      if (v == null) {
        await client.query(`select set_config($1, NULL, true)`, [k]);
      } else {
        await client.query(`select set_config($1, $2, true)`, [k, String(v)]);
      }
    }

    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}


