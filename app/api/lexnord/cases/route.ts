import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthContext } from "@/lib/auth-context";
import { withGUC } from "@/lib/withGUC";
import { resolveLexNordContext } from "@/lib/lexnord";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const client = await pool.connect();
    try {
      const ctx = await resolveLexNordContext(client, auth.clerkUserId, req);
      const url = new URL(req.url);
      const statusParam = url.searchParams.get("status");
      const statuses = statusParam
        ? statusParam.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

      const rows = await withGUC(client, {
        "request.user_id": ctx.userId,
        "request.clerk_user_id": auth.clerkUserId,
        "request.org_id": ctx.orgId,
        "request.org_role": ctx.role,
        "request.org_status": ctx.status,
        "request.mfa": auth.mfaVerified ? "on" : "off",
      }, async () => {
        const values: any[] = [ctx.orgId];
        let filter = "";
        if (statuses.length) {
          values.push(statuses);
          filter = "and c.status = any($2::text[])";
        }
        const sql = `
          select c.id,
                 c.title,
                 c.client_name,
                 c.status,
                 c.assigned_user_id,
                 c.metadata,
                 u.primary_email as assigned_user_email
            from public.cases c
            left join public.users u on u.id = c.assigned_user_id
           where c.organization_id = $1
             ${filter}
           order by c.created_at desc
        `;
        const result = await client.query(sql, values);
        return result.rows;
      });

      return NextResponse.json({ ok: true, cases: rows });
    } finally {
      client.release();
    }
  } catch (error: any) {
    const status = error?.status ?? 500;
    const message = status === 403 ? "forbidden" : "internal_error";
    if (status === 500) {
      console.error("[lexnord.cases.get]", error);
    }
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

