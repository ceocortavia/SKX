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
      const rows = await withGUC(client, {
        "request.user_id": ctx.userId,
        "request.clerk_user_id": auth.clerkUserId,
        "request.org_id": ctx.orgId,
        "request.org_role": ctx.role,
        "request.org_status": ctx.status,
        "request.mfa": auth.mfaVerified ? "on" : "off",
      }, async () => {
        const result = await client.query(
          `select m.user_id as id,
                  u.full_name,
                  u.primary_email,
                  m.role
             from public.memberships m
             join public.users u on u.id = m.user_id
            where m.organization_id = $1
              and m.status = 'approved'
              and m.role in ('admin','member')
            order by m.role desc, u.full_name nulls last, u.primary_email nulls last
          `,
          [ctx.orgId]
        );
        return result.rows;
      });
      return NextResponse.json({ ok: true, users: rows });
    } finally {
      client.release();
    }
  } catch (error: any) {
    const status = error?.status ?? 500;
    const message = status === 403 ? "forbidden" : "internal_error";
    if (status === 500) {
      console.error("[lexnord.users.get]", error);
    }
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

