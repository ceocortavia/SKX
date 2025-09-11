export const runtime = "nodejs";

import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthContext } from "@/lib/auth-context";
import { resolveOrgContext } from "@/lib/org-context";
import { withGUC } from "@/lib/withGUC";
import { validateUserIdsLimit } from "@/lib/validateBulk";
import { fail } from "@/lib/apiResponse";
import { rateLimit } from "@/lib/rateLimit";
import { bulkUserIdsSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  try {
    // Feature flag check
    if (process.env.ADMIN_BULK_MEMBERS_ENABLED !== "1") {
      return NextResponse.json({
        error: "Bulk members not enabled"
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
      const rl = rateLimit({ limit: 5, windowMs: 10_000, key: `${clerkUserId}:bulk-revoke` });
      if (!rl.allowed) return fail("rate_limited", "too_many_requests", 429, { retryAfterMs: rl.remainingMs });

      // Robust JSON parse + Zod before org resolution
      let raw = "";
      try { raw = await req.text(); } catch { return fail("invalid_json", "malformed_json", 400); }
      let body: unknown;
      try { body = raw ? JSON.parse(raw) : {}; } catch { return fail("invalid_json", "malformed_json", 400); }
      const parsed = bulkUserIdsSchema.safeParse(body);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        let reason = issue?.message || "invalid_body";
        if (issue?.path?.[0] === "userIds") {
          if (issue.code === "too_small") reason = "empty_userIds";
          if (issue.code === "too_big") reason = "too_many_userIds";
        }
        return fail("invalid_input", reason, 400);
      }
      const { userIds } = parsed.data;

      // Early hard limit validation (<=100)
      const limit = validateUserIdsLimit(userIds);
      if (!limit.ok) return NextResponse.json(limit.body, { status: limit.status });

      // Proceed to resolve org now
      const { userId, org } = await resolveOrgContext(client, clerkUserId, req);

      if (!org) return fail("forbidden", "no_org_access", 403);

      // Only admins/owners can bulk revoke
      if (!['admin', 'owner'].includes(org.role)) return fail("forbidden", "insufficient_permissions", 403);

      if (!Array.isArray(userIds)) return fail("invalid_input", "userIds_must_be_array", 400);

      // Already validated max size; proceed with provided userIds
      const limitedUserIds = userIds;

      if (limitedUserIds.length === 0) return fail("invalid_input", "empty_userIds", 400);

      const result = await withGUC(client, {
        "request.clerk_user_id": clerkUserId,
        "request.user_id": userId ?? "",
        "request.org_id": org?.id ?? "",
        "request.org_role": org?.role ?? "",
        "request.org_status": org?.status ?? "",
        "request.mfa": "on", // MFA verified for this operation
      }, async () => {
        // Update memberships to pending status (effectively "revoking" them)
        // RLS ensures only memberships from this org can be updated
        // Don't allow revoking owners
        const res = await client.query(`
          UPDATE public.memberships
          SET status = 'pending',
              updated_at = NOW()
          WHERE user_id = ANY($1::uuid[])
            AND organization_id = nullif(current_setting('request.org_id', true), '')::uuid
            AND status = 'approved'
            AND role != 'owner'
          RETURNING user_id, organization_id, role, status
        `, [limitedUserIds]);

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
          'bulk_revoke_to_pending',
          'memberships',
          null,
          JSON.stringify({
            count: result.length,
            total_requested: limitedUserIds.length,
            revoked_to_pending_user_ids: result.map(r => r.user_id),
            by: org?.role
          })
        ]);
      });

      return NextResponse.json({
        success: true,
        revoked: result.length,
        requested: limitedUserIds.length,
        details: result.map(r => ({ user_id: r.user_id, role: r.role }))
      });

    } finally {
      client.release();
    }

  } catch (err: any) {
    console.error("POST /api/memberships/bulk-revoke error", err);
    return NextResponse.json(
      { error: "Internal Server Error", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
