export const runtime = "nodejs";

import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthContext } from "@/lib/auth-context";
import { resolveOrgContext } from "@/lib/org-context";
import { withGUC } from "@/lib/withGUC";

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

      const rows = await withGUC(client, {
        "request.clerk_user_id": clerkUserId,
        "request.user_id": userId ?? "",
        "request.org_id": org?.id ?? "",
        "request.org_role": org?.role ?? "",
        "request.org_status": org?.status ?? "",
        "request.mfa": mfaVerified ? "on" : "off",
      }, async () => {
        // This SELECT is evaluated under RLS using the GUCs above
        const res = await client.query(`
          select user_id, organization_id, role, status, created_at
          from public.memberships
          where organization_id = nullif(current_setting('request.org_id', true),'')::uuid
          order by role desc, status asc, user_id asc
        `);
        return res.rows;
      });

      return NextResponse.json({ 
        memberships: rows,
        org,
        me: { clerkUserId, email, mfaVerified }
      });
      
    } finally {
      client.release();
    }
    
  } catch (err: any) {
    console.error("GET /api/memberships error", err);
    return NextResponse.json(
      { error: "Internal Server Error", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
