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
    
    // MFA requirement for admin operations
    if (!mfaVerified) {
      return NextResponse.json({ 
        error: "MFA required for admin operations" 
      }, { status: 403 });
    }

    const client = await pool.connect();
    
    try {
      const { userId, org } = await resolveOrgContext(client, clerkUserId, req);
      
      if (!org) {
        return NextResponse.json({ error: "No organization access" }, { status: 403 });
      }

      // Only admins/owners can view audit events
      if (!['admin', 'owner'].includes(org.role)) {
        return NextResponse.json({ 
          error: "Insufficient permissions" 
        }, { status: 403 });
      }

      // Parse pagination parameters
      const url = new URL(req.url);
      const page = parseInt(url.searchParams.get('page') || '1');
      const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
      const offset = (page - 1) * pageSize;

      const result = await withGUC(client, {
        "request.clerk_user_id": clerkUserId,
        "request.user_id": userId ?? "",
        "request.org_id": org?.id ?? "",
        "request.org_role": org?.role ?? "",
        "request.org_status": org?.status ?? "",
        "request.mfa": "on", // MFA verified for this operation
      }, async () => {
        // This SELECT is evaluated under RLS using the GUCs above
        const res = await client.query(`
          SELECT created_at, actor_user_id, action, target_table, target_pk, metadata
          FROM public.audit_events
          WHERE actor_org_id = nullif(current_setting('request.org_id', true), '')::uuid
          ORDER BY created_at DESC
          LIMIT $1 OFFSET $2
        `, [pageSize, offset]);
        return res.rows;
      });

      // Get total count for pagination
      const countResult = await withGUC(client, {
        "request.clerk_user_id": clerkUserId,
        "request.user_id": userId ?? "",
        "request.org_id": org?.id ?? "",
        "request.org_role": org?.role ?? "",
        "request.org_status": org?.status ?? "",
        "request.mfa": "on",
      }, async () => {
        const res = await client.query(`
          SELECT COUNT(*) as total
          FROM public.audit_events
          WHERE actor_org_id = nullif(current_setting('request.org_id', true), '')::uuid
        `);
        return res.rows[0].total;
      });

      const total = parseInt(countResult);
      const nextOffset = offset + pageSize < total ? offset + pageSize : null;

      return NextResponse.json({ 
        rows: result,
        page,
        pageSize,
        total,
        nextOffset,
        org
      });
      
    } finally {
      client.release();
    }
    
  } catch (err: any) {
    console.error("GET /api/audit error", err);
    return NextResponse.json(
      { error: "Internal Server Error", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
