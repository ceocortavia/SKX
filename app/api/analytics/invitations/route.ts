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
        const totalQ = await client.query(
          `select count(*)::int as total
             from invitations i
            where i.organization_id = nullif(current_setting('request.org_id', true), '')::uuid`
        );

        // stacked series by day (pending/accepted)
        const seriesQ = await client.query(
          `with base as (
             select date_trunc('day', created_at) as d,
                    status
               from invitations
              where organization_id = nullif(current_setting('request.org_id', true), '')::uuid
                and created_at >= now() - ($1 || ' days')::interval
           )
           select d::date,
                  sum(case when status = 'pending' then 1 else 0 end)::int as pending,
                  sum(case when status = 'accepted' then 1 else 0 end)::int as accepted
             from base
            group by 1
            order by 1 asc`, [days]
        );

        return {
          total: totalQ.rows[0]?.total ?? 0,
          series: seriesQ.rows.map(r => ({
            date: r.d.toISOString().slice(0,10),
            pending: r.pending,
            accepted: r.accepted,
          })),
        };
      });

      return NextResponse.json(result);

    } finally {
      client.release();
    }

  } catch (err: any) {
    console.error("GET /api/analytics/invitations error", err);
    return NextResponse.json(
      { error: "Internal Server Error", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}














