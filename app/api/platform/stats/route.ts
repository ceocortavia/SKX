import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthContext } from "@/lib/auth-context";
import { ensurePlatformRoleGUC, listEnvSuperAdmins, requirePlatformSuper, resolvePlatformAdmin } from "@/lib/platform-admin";
import { withGUC } from "@/lib/withGUC";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const client = await pool.connect();
    try {
      const ctx = await resolvePlatformAdmin(client, auth.clerkUserId, auth.email);
      requirePlatformSuper(ctx);
      await ensurePlatformRoleGUC(client, ctx);

      const stats = await withGUC(client, { "request.platform_role": "super_admin" }, async () => {
        const [organizations, members, approvedMembers, pendingInvitations, dbAdmins] = await Promise.all([
          client.query(`select count(*)::int as count from public.organizations`),
          client.query(`select count(*)::int as count from public.memberships`),
          client.query(`select count(*)::int as count from public.memberships where status = 'approved'`),
          client.query(`select count(*)::int as count from public.invitations where status = 'pending'`),
          client.query(
            `select u.primary_email as email
               from public.platform_admins pa
               join public.users u on u.id = pa.user_id`
          ),
        ]);

        return {
          organizations: organizations.rows[0]?.count ?? 0,
          members: members.rows[0]?.count ?? 0,
          approvedMembers: approvedMembers.rows[0]?.count ?? 0,
          pendingInvitations: pendingInvitations.rows[0]?.count ?? 0,
          dbAdminEmails: dbAdmins.rows.map((row) => (row.email || '').toLowerCase()).filter(Boolean),
        };
      });

      const envAdmins = listEnvSuperAdmins();
      const uniqueSuperAdmins = new Set<string>([
        ...stats.dbAdminEmails,
        ...envAdmins.map((email) => email.toLowerCase()),
      ]);

      const dbSuperAdmins = stats.dbAdminEmails.length;
      const totalSuperAdmins = uniqueSuperAdmins.size;

      return NextResponse.json({
        ok: true,
        stats: {
          organizations: stats.organizations,
          members: stats.members,
          approvedMembers: stats.approvedMembers,
          pendingInvitations: stats.pendingInvitations,
          dbSuperAdmins,
          envSuperAdmins: envAdmins.length,
          totalSuperAdmins,
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[platform.stats.get]", error);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
