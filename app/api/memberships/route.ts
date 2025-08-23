import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
export const runtime = "nodejs";
import { withGUC } from "@/lib/withGUC";
import { pool } from "@/lib/db";

// List brukerens memberships på tvers av orgs (brukes av org-switcher)
export async function GET(req: Request) {
  const { clerkUserId, email } = await getAuthContext(req);
  if (!clerkUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await pool.connect();
  try {
    const u = await client.query(`select id from public.users where clerk_user_id=$1`, [clerkUserId]);
    if (!u.rows[0]) return NextResponse.json({ error: "User not provisioned" }, { status: 403 });
    const userId: string = u.rows[0].id;

    const data = await withGUC(
      { userId, clerkUserId, clerkUserEmail: email ?? undefined, mfa: "off" },
      async (tx) => {
        const res = await tx.query(
          `select m.user_id, m.organization_id as org_id, m.role, m.status, o.name as org_name
           from public.memberships m
           join public.organizations o on o.id = m.organization_id
           where m.user_id = $1
           order by (m.status='approved') desc, o.name asc`,
          [userId]
        );
        return res.rows;
      }
    );
    return NextResponse.json({ memberships: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Error" }, { status: 500 });
  } finally {
    client.release();
  }
}


