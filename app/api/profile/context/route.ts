import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthContext } from "@/lib/auth-context";
import { withGUC } from "@/lib/withGUC";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const client = await pool.connect();
    try {
      const userRes = await client.query<{ id: string }>(
        `select id from public.users where clerk_user_id=$1 limit 1`,
        [auth.clerkUserId]
      );
      if (userRes.rowCount === 0) {
        return NextResponse.json({
          organization: null,
          membership: null,
          auth: { mfaVerified: auth.mfaVerified },
          permissions: {
            canInvite: false,
            canManageDomains: false,
            canBulkMembers: false,
            canBulkRole: false,
            readOnly: true,
          },
        });
      }
      const internalUserId = userRes.rows[0].id;

      const orgSel = await client.query<{ organization_id: string; orgnr: string | null; org_name: string | null }>(
        `select organization_id, orgnr, org_name from public.user_org_selection where user_id=$1 limit 1`,
        [internalUserId]
      );
      if (orgSel.rowCount === 0) {
        return NextResponse.json({
          organization: null,
          membership: null,
          auth: { mfaVerified: auth.mfaVerified },
          permissions: {
            canInvite: false,
            canManageDomains: false,
            canBulkMembers: false,
            canBulkRole: false,
            readOnly: true,
          },
        });
      }

      const { organization_id, orgnr, org_name } = orgSel.rows[0];

      const data = await withGUC(client, {
        "request.user_id": internalUserId,
        "request.org_id": organization_id,
      }, async () => {
        const memRes = await client.query<{ role: string; status: string }>(
          `select role, status from public.memberships where organization_id=$1 and user_id=$2 limit 1`,
          [organization_id, internalUserId]
        );
        return { membership: memRes.rowCount ? memRes.rows[0] : null };
      });

      const role = data.membership?.role ?? null;
      const status = data.membership?.status ?? null;
      const isAdminLike = role === "owner" || role === "admin";
      const isPending = status === "pending";

      const canInvite = isAdminLike && auth.mfaVerified && !isPending;
      const canManageDomains = isAdminLike && auth.mfaVerified && !isPending;
      const canBulkMembers = isAdminLike && !isPending && process.env.ADMIN_BULK_MEMBERS_ENABLED === "1";
      const canBulkRole = isAdminLike && !isPending && process.env.ADMIN_BULK_ROLE_ENABLED === "1";

      return NextResponse.json({
        organization: { id: organization_id, orgnr, name: org_name },
        membership: data.membership,
        auth: { mfaVerified: auth.mfaVerified },
        permissions: {
          canInvite,
          canManageDomains,
          canBulkMembers,
          canBulkRole,
          readOnly: isPending || !role,
        },
      });
    } finally {
      client.release();
    }
  } catch (err) {
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
