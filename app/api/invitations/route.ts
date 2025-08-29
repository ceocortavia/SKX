

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

      // Only admins/owners can view invitations
      if (!['admin', 'owner'].includes(org.role)) {
        return NextResponse.json({ 
          error: "Insufficient permissions" 
        }, { status: 403 });
      }

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
          SELECT id, email, requested_role, status, expires_at, created_at
          FROM public.invitations
          WHERE organization_id = nullif(current_setting('request.org_id', true), '')::uuid
          ORDER BY created_at DESC
        `);
        return res.rows;
      });

      return NextResponse.json({ 
        invitations: result,
        org
      });
      
    } finally {
      client.release();
    }
    
  } catch (err: any) {
    console.error("GET /api/invitations error", err);
    return NextResponse.json(
      { error: "Internal Server Error", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

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

      // Only admins/owners can create invitations
      if (!['admin', 'owner'].includes(org.role)) {
        return NextResponse.json({ 
          error: "Insufficient permissions" 
        }, { status: 403 });
      }

      const body = await req.json();
      const { email: inviteEmail, requested_role = 'member', expires_days = 7 } = body;

      if (!inviteEmail) {
        return NextResponse.json({ 
          error: "Email is required" 
        }, { status: 400 });
      }

      if (!['member', 'admin'].includes(requested_role)) {
        return NextResponse.json({ 
          error: "Invalid role. Must be 'member' or 'admin'" 
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
          INSERT INTO public.invitations (organization_id, email, requested_role, status, expires_at, invited_by)
          VALUES ($1::uuid, $2, $3::member_role, 'pending', now() + ($4 || ' days')::interval, $5::uuid)
          RETURNING id, organization_id, email, requested_role, status, expires_at, created_at
        `, [org.id, inviteEmail, requested_role, expires_days, userId]);
        return res.rows[0];
      });

      return NextResponse.json({ 
        invitation: result,
        message: "Invitation created successfully"
      });
      
    } finally {
      client.release();
    }
    
  } catch (err: any) {
    console.error("POST /api/invitations error", err);
    return NextResponse.json(
      { error: "Internal Server Error", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
