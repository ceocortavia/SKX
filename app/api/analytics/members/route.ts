import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthContext } from "@/lib/auth-context";
import { resolveOrgContext } from "@/lib/org-context";
import { withGUC } from "@/lib/withGUC";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const authContext = await getAuthContext(req);
    if (!authContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clerkUserId, email, mfaVerified } = authContext;
    const client = await pool.connect();

    try {
      const { userId, org } = await resolveOrgContext(client, clerkUserId, req);

      if (!org) {
        return NextResponse.json({ error: "No organization access" }, { status: 403 });
      }

      const result = await withGUC(client, {
        "request.clerk_user_id": clerkUserId,
        "request.user_id": userId ?? "",
        "request.org_id": org?.id ?? "",
        "request.org_role": org?.role ?? "",
        "request.org_status": org?.status ?? "",
        "request.mfa": mfaVerified ? "on" : "off",
      }, async () => {
        // totals
        const totalQ = await client.query(
          `select count(*)::int as total
           from memberships m
           where m.organization_id = nullif(current_setting('request.org_id', true), '')::uuid`
        );

        // by role
        const roleQ = await client.query(
          `select role, count(*)::int as n
             from memberships
            where organization_id = nullif(current_setting('request.org_id', true), '')::uuid
            group by role`
        );

        // by status
        const statusQ = await client.query(
          `select status, count(*)::int as n
             from memberships
            where organization_id = nullif(current_setting('request.org_id', true), '')::uuid
            group by status`
        );

        const byRole: Record<string, number> = {};
        roleQ.rows.forEach(r => byRole[r.role] = r.n);

        const byStatus: Record<string, number> = {};
        statusQ.rows.forEach(r => byStatus[r.status] = r.n);

        return {
          total: totalQ.rows[0]?.total ?? 0,
          byRole,
          byStatus,
        };
      });

      return NextResponse.json(result);

    } finally {
      client.release();
    }

  } catch (err: any) {
    console.error("GET /api/analytics/members error", err);
    return NextResponse.json(
      { error: "Internal Server Error", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}














