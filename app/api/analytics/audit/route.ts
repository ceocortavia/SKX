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

      const url = new URL(req.url);
      const days = Math.min(Number(url.searchParams.get("days") ?? 30), 90) || 30;

      const result = await withGUC(client, {
        "request.clerk_user_id": clerkUserId,
        "request.user_id": userId ?? "",
        "request.org_id": org?.id ?? "",
        "request.org_role": org?.role ?? "",
        "request.org_status": org?.status ?? "",
        "request.mfa": mfaVerified ? "on" : "off",
      }, async () => {
        // top actions (count by action within window)
        const actionsQ = await client.query(
          `select action, count(*)::int as n
             from audit_events
            where actor_org_id = nullif(current_setting('request.org_id', true), '')::uuid
              and created_at >= now() - ($1 || ' days')::interval
            group by 1
            order by n desc
            limit 5`, [days]
        );

        // time series (total events per day)
        const seriesQ = await client.query(
          `select date_trunc('day', created_at) as d, count(*)::int as n
             from audit_events
            where actor_org_id = nullif(current_setting('request.org_id', true), '')::uuid
              and created_at >= now() - ($1 || ' days')::interval
            group by 1
            order by 1 asc`, [days]
        );

        return {
          actions: actionsQ.rows.map(r => ({ action: r.action, count: r.n })),
          series: seriesQ.rows.map(r => ({ date: r.d.toISOString().slice(0,10), count: r.n })),
        };
      });

      return NextResponse.json(result);

    } finally {
      client.release();
    }

  } catch (err: any) {
    console.error("GET /api/analytics/audit error", err);
    return NextResponse.json(
      { error: "Internal Server Error", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}



