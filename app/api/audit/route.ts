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

      // Parse query parameters
      const url = new URL(req.url);
      const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50'), 1), 200);
      const cursor = url.searchParams.get('cursor');
      const action = url.searchParams.get('action');
      const fromIso = url.searchParams.get('from');
      const toIso = url.searchParams.get('to');

      // Parse cursor if provided
      let cursorTs: string | null = null;
      let cursorId: string | null = null;
      if (cursor) {
        const parts = cursor.split('_');
        if (parts.length === 2) {
          [cursorTs, cursorId] = parts;
        }
      }

      const result = await withGUC(client, {
        "request.clerk_user_id": clerkUserId,
        "request.user_id": userId ?? "",
        "request.org_id": org?.id ?? "",
        "request.org_role": org?.role ?? "",
        "request.org_status": org?.status ?? "",
        "request.mfa": "on", // MFA verified for this operation
      }, async () => {
        // Build query with filters
        const args: any[] = [];
        let whereClause = `actor_org_id = nullif(current_setting('request.org_id', true), '')::uuid`;
        
        // Add cursor condition
        if (cursorTs && cursorId) {
          whereClause += ` AND (created_at, id) < ($${args.length + 1}, $${args.length + 2})`;
          args.push(cursorTs, cursorId);
        }
        
        // Add action filter
        if (action) {
          whereClause += ` AND action ILIKE $${args.length + 1}`;
          args.push(action.replace(/%/g, '') + '%');
        }
        
        // Add date range filters
        if (fromIso) {
          whereClause += ` AND created_at >= $${args.length + 1}`;
          args.push(fromIso);
        }
        
        if (toIso) {
          whereClause += ` AND created_at < $${args.length + 1}`;
          args.push(toIso);
        }

        // Execute query with limit + 1 to check if there are more pages
        const res = await client.query(`
          SELECT id, created_at, actor_user_id, action, target_table, target_pk, metadata
          FROM public.audit_events
          WHERE ${whereClause}
          ORDER BY created_at DESC, id DESC
          LIMIT $${args.length + 1}
        `, [...args, limit + 1]);

        return res.rows;
      });

      // Check if there are more pages
      const hasMore = result.length > limit;
      const page = hasMore ? result.slice(0, limit) : result;
      
      // Generate next cursor
      let nextCursor: string | null = null;
      if (hasMore && page.length > 0) {
        const lastRow = page[page.length - 1];
        nextCursor = `${lastRow.created_at.toISOString()}_${lastRow.id}`;
      }

      return NextResponse.json({ 
        items: page,
        nextCursor,
        hasMore,
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
