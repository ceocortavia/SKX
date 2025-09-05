export const runtime = "nodejs";

import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthContext } from "@/lib/auth-context";
import { resolveOrgContext } from "@/lib/org-context";
import { withGUC } from "@/lib/withGUC";
import { validateIdsLimit } from "@/lib/validateBulk";
import { fail } from "@/lib/apiResponse";
import { rateLimit } from "@/lib/rateLimit";
import { invitationIdsSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  try {
    // Feature flag check
    if (process.env.ADMIN_BULK_REVOCATION_ENABLED !== "1") {
      return NextResponse.json({ 
        error: "Bulk revocation not enabled" 
      }, { status: 403 });
    }

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
      // Lightweight rate limit per user+route (before org resolution)
      const rl = rateLimit({ limit: 5, windowMs: 10_000, key: `${clerkUserId}:invitations-bulk-revoke` });
      if (!rl.allowed) return fail("rate_limited", "too_many_requests", 429, { retryAfterMs: rl.remainingMs });

      // Robust JSON parse + Zod before org resolution
      let raw = "";
      try { raw = await req.text(); } catch { return fail("invalid_json", "read_body_failed", 400); }
      if (!raw || raw.trim() === "") {
        return fail("invalid_json", "empty_body", 400);
      }
      let body: unknown;
      try { body = raw ? JSON.parse(raw) : {}; } catch { return fail("invalid_json", "malformed_json", 400); }
      const parsed = invitationIdsSchema.safeParse(body);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const reason = issue?.message === "empty_invitationIds"
          ? "empty_invitationIds"
          : issue?.message === "too_many_invitationIds"
          ? "too_many_invitationIds"
          : "invalid_input";
        return fail("invalid_input", reason, 400, { issues: parsed.error.issues });
      }
      const { invitationIds } = parsed.data;

      // Early hard limit validation (<=100)
      const limit = validateIdsLimit(invitationIds);
      if (!limit.ok) return NextResponse.json(limit.body, { status: limit.status });

      // Proceed to resolve org now
      const { userId, org } = await resolveOrgContext(client, clerkUserId, req);

      if (!org) return fail("forbidden", "no_org_access", 403);

      // Only admins/owners can bulk revoke
      if (!['admin', 'owner'].includes(org.role)) return fail("forbidden", "insufficient_permissions", 403);

      if (!Array.isArray(invitationIds)) return fail("invalid_input", "ids_must_be_array", 400);

      // Already validated max size; proceed with provided ids
      const limitedIds = invitationIds;
      
      if (limitedIds.length === 0) return fail("invalid_input", "empty_ids", 400);

      const result = await withGUC(client, {
        "request.clerk_user_id": clerkUserId,
        "request.user_id": userId ?? "",
        "request.org_id": org?.id ?? "",
        "request.org_role": org?.role ?? "",
        "request.org_status": org?.status ?? "",
        "request.mfa": "on", // MFA verified for this operation
      }, async () => {
        // Update invitations to revoked status
        // RLS ensures only invitations from this org can be updated
        const res = await client.query(`
          UPDATE public.invitations 
          SET status = 'revoked', 
              updated_at = NOW()
          WHERE id = ANY($1::uuid[]) 
            AND organization_id = nullif(current_setting('request.org_id', true), '')::uuid
            AND status = 'pending'
          RETURNING id, email, requested_role
        `, [limitedIds]);

        return res.rows;
      });

      // Log audit event
      await withGUC(client, {
        "request.clerk_user_id": clerkUserId,
        "request.user_id": userId ?? "",
        "request.org_id": org?.id ?? "",
        "request.org_role": org?.role ?? "",
        "request.org_status": org?.status ?? "",
        "request.mfa": "on",
      }, async () => {
        await client.query(`
          INSERT INTO public.audit_events (
            actor_user_id, actor_org_id, action, target_table, target_pk, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          userId,
          org?.id,
          'bulk_revoke',
          'invitations',
          null,
          JSON.stringify({
            count: result.length,
            total_requested: limitedIds.length,
            revoked_ids: result.map(r => r.id),
            by: org?.role
          })
        ]);
      });

      return NextResponse.json({ 
        success: true,
        revoked: result.length,
        requested: limitedIds.length,
        details: result.map(r => ({ id: r.id, email: r.email, role: r.requested_role }))
      });
      
    } finally {
      client.release();
    }
    
  } catch (err: any) {
    console.error("POST /api/invitations/bulk-revoke error", err);
    return NextResponse.json(
      { error: "Internal Server Error", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

