

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthContext } from "@/lib/auth-context";
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
      // Get user ID from clerk_user_id
      const userResult = await client.query(
        `SELECT id FROM public.users WHERE clerk_user_id = $1`,
        [clerkUserId]
      );
      
      if (!userResult.rows[0]) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      
      const userId = userResult.rows[0].id;

      const body = await req.json();
      const { full_name } = body;

      if (!full_name) {
        return NextResponse.json({ 
          error: "full_name is required" 
        }, { status: 400 });
      }

      // Update safe fields under RLS policy (users_update_self_safe)
      const result = await withGUC(client, {
        "request.clerk_user_id": clerkUserId,
        "request.user_id": userId,
        "request.org_id": "", // Not needed for user self-update
        "request.org_role": "", // Not needed for user self-update
        "request.org_status": "", // Not needed for user self-update
        "request.mfa": mfaVerified ? "on" : "off",
      }, async () => {
        // This UPDATE is evaluated under RLS using the GUCs above
        const res = await client.query(`
          UPDATE public.users 
          SET full_name = $1, updated_at = now()
          WHERE clerk_user_id = $2
          RETURNING id, clerk_user_id, full_name, updated_at
        `, [full_name, clerkUserId]);
        return res.rows[0];
      });

      if (!result) {
        return NextResponse.json({ 
          error: "Update failed - check permissions" 
        }, { status: 403 });
      }

      return NextResponse.json({ 
        user: result,
        message: "User updated successfully"
      });
      
    } finally {
      client.release();
    }
    
  } catch (err: any) {
    console.error("POST /api/users/update-safe error", err);
    return NextResponse.json(
      { error: "Internal Server Error", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
