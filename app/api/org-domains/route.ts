export const runtime = "nodejs";

import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthContext } from "@/lib/auth-context";
import { resolveOrgContext } from "@/lib/org-context";
import { withGUC } from "@/lib/withGUC";

export async function POST(req: Request) {
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

      // Only admins/owners can add domains
      if (!['admin', 'owner'].includes(org.role)) {
        return NextResponse.json({ 
          error: "Insufficient permissions" 
        }, { status: 403 });
      }

      const body = await req.json();
      const { domain, verified = false } = body;

      if (!domain) {
        return NextResponse.json({ 
          error: "Domain is required" 
        }, { status: 400 });
      }

      const result = await withGUC(client, {
        "request.clerk_user_id": clerkUserId,
        "request.user_id": userId ?? "",
        "request.org_id": org?.id ?? "",
        "request.org_role": org?.role ?? "",
        "request.org_status": org?.status ?? "",
        "request.mfa": "on", // MFA verified for this operation
      }, async () => {
        // This INSERT is evaluated under RLS using the GUCs above
        const res = await client.query(`
          INSERT INTO public.organization_domains (organization_id, domain, verified)
          VALUES ($1, $2, $3)
          RETURNING id, organization_id, domain, verified, created_at
        `, [org.id, domain, verified]);
        return res.rows[0];
      });

      return NextResponse.json({ 
        domain: result,
        message: "Domain added successfully"
      });
      
    } finally {
      client.release();
    }
    
  } catch (err: any) {
    console.error("POST /api/org-domains error", err);
    return NextResponse.json(
      { error: "Internal Server Error", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
