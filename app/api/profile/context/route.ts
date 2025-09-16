export const dynamic = "force-dynamic";
export const revalidate = 0;
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import pool from "@/lib/db";
import { withGUC } from "@/lib/withGUC";
import { getAuthContext } from "@/lib/auth-context";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    const clerkUserId = auth.clerkUserId;

    const client = await pool.connect();
    try {
      // Finn intern users.id (uuid)
      let internalUserId: string | null = null;
      const ures = await client.query<{ id: string }>(
        `select id from public.users where clerk_user_id = $1 limit 1`,
        [clerkUserId]
      );
      if (ures.rowCount) internalUserId = ures.rows[0].id;
      if (!internalUserId) {
        return NextResponse.json({ ok: true, organization: null, membership: null, mfa: false, permissions: [] });
      }

      // Hent valgt org via user_org_selection → organizations under RLS (request.user_id)
      const orgJoin = await withGUC(client, {
        "request.user_id": internalUserId,
      }, async () => {
        const r = await client.query<{ id: string; orgnr: string | null; name: string | null }>(
          `select o.id, o.orgnr, o.name
           from public.user_org_selection uos
           join public.organizations o on o.id = uos.organization_id
           where uos.user_id = $1
           limit 1`,
          [internalUserId]
        );
        return r.rows[0] ?? null;
      });

      let organization = orgJoin;

      // Fallback: cookie orgId → slå opp organizations direkte
      if (!organization) {
        const orgIdCookie = (await cookies()).get("orgId")?.value;
        if (orgIdCookie) {
          const r = await client.query<{ id: string; orgnr: string | null; name: string | null }>(
            `select id, orgnr, name from public.organizations where id = $1 limit 1`,
            [orgIdCookie]
          );
          organization = r.rows[0] ?? null;
        }
      }

      if (!organization) {
        return NextResponse.json({ ok: true, organization: null, membership: null, mfa: false, permissions: [] }, { headers: { "Cache-Control": "no-store" } });
      }

      // Hent membership i valgt org under RLS (sett også request.org_id)
      const membership = await withGUC(client, {
        "request.user_id": internalUserId,
        "request.org_id": organization.id,
      }, async () => {
        const r = await client.query<{ role: "owner" | "admin" | "member"; status: "approved" | "pending" }>(
          `select role, status from public.memberships where user_id=$1 and organization_id=$2 limit 1`,
          [internalUserId, organization.id]
        );
        return r.rows[0] ?? null;
      });

      const isAdminLike = membership?.role === "owner" || membership?.role === "admin";
      const isPending = membership?.status === "pending";
      const permissions = {
        canInvite: !!isAdminLike && !isPending,
        canManageDomains: !!isAdminLike && !isPending,
        canBulkMembers: !!isAdminLike && !isPending && process.env.ADMIN_BULK_MEMBERS_ENABLED === "1",
        canBulkRole: !!isAdminLike && !isPending && process.env.ADMIN_BULK_ROLE_ENABLED === "1",
        readOnly: !membership || isPending,
      };

      return NextResponse.json({
        ok: true,
        organization,
        membership,
        mfa: false,
        permissions,
      }, { headers: { "Cache-Control": "no-store" } });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("profile/context error", err);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
