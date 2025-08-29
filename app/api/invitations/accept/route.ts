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
    const client = await pool.connect();
    
    try {
      const { userId, org } = await resolveOrgContext(client, clerkUserId, req);
      
      if (!org) {
        return NextResponse.json({ error: "No organization access" }, { status: 403 });
      }

      // Check if user has a pending invitation for this org
      const invitationResult = await withGUC(client, {
        "request.clerk_user_id": clerkUserId,
        "request.user_id": userId ?? "",
        "request.org_id": org?.id ?? "",
        "request.org_role": org?.role ?? "",
        "request.org_status": org?.status ?? "",
        "request.mfa": mfaVerified ? "on" : "off",
      }, async () => {
        // Find active invitation for this user's email
        const res = await client.query(`
          SELECT id, email, requested_role, status, expires_at
          FROM public.invitations
          WHERE organization_id = nullif(current_setting('request.org_id', true), '')::uuid
            AND email = $1
            AND status = 'pending'
            AND expires_at > now()
        `, [email]);
        return res.rows[0];
      });

      if (!invitationResult) {
        return NextResponse.json({ 
          error: "No active invitation found for this email and organization" 
        }, { status: 404 });
      }

      // Accept the invitation and create/update membership
      const result = await withGUC(client, {
        "request.clerk_user_id": clerkUserId,
        "request.user_id": userId ?? "",
        "request.org_id": org?.id ?? "",
        "request.org_role": org?.role ?? "",
        "request.org_status": org?.status ?? "",
        "request.mfa": mfaVerified ? "on" : "off",
      }, async () => {
        // Start transaction
        await client.query('BEGIN');
        
        try {
          // Update invitation status
          await client.query(`
            UPDATE public.invitations
            SET status = 'accepted'
            WHERE id = $1
          `, [invitationResult.id]);

          // Ensure membership exists (pending → approved if desired policy)
          const membershipResult = await client.query(`
            INSERT INTO public.memberships (user_id, organization_id, role, status)
            VALUES ($1, $2, $3, 'pending')
            ON CONFLICT (user_id, organization_id) 
            DO UPDATE SET 
              role = EXCLUDED.role,
              updated_at = now()
            RETURNING user_id, organization_id, role, status
          `, [userId, org.id, invitationResult.requested_role]);

          await client.query('COMMIT');
          return membershipResult.rows[0];
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      });

      return NextResponse.json({ 
        membership: result,
        invitation: invitationResult,
        message: "Invitation accepted successfully"
      });
      
    } finally {
      client.release();
    }
    
  } catch (err: any) {
    console.error("POST /api/invitations/accept error", err);
    return NextResponse.json(
      { error: "Internal Server Error", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
