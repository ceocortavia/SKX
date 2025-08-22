import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { withGUC } from "@/lib/withGUC";
import { resolveOrgContext } from "@/lib/org-context";
import { pool } from "@/lib/db";
import { getOrgHint, setOrgCookie } from "@/lib/org-hint";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await pool.connect();
  try {
    const u = await client.query(`select id, primary_email from public.users where clerk_user_id=$1`, [clerkUserId]);
    if (!u.rows[0]) return NextResponse.json({ error: "User not provisioned" }, { status: 403 });
    const userId: string = u.rows[0].id;
    const email: string = u.rows[0].primary_email;

    const { hintedOrgId } = getOrgHint(req);
    const { orgId, orgRole, orgStatus } = await resolveOrgContext(client, { userId, hintedOrgId });

    const data = await withGUC(
      { userId, clerkUserId, clerkUserEmail: email, orgId, orgRole, orgStatus, mfa: "off" },
      async (tx) => {
        const res = await tx.query(
          `select id, actor_user_id, actor_org_id, action, target_table, target_pk, metadata, created_at
           from public.audit_events
           order by created_at desc
           limit 20`
        );
        return res.rows;
      }
    );

    const resp = NextResponse.json({ events: data });
    if (orgId) {
      resp.headers.set("x-org-id", orgId);
      setOrgCookie(orgId);
    }
    return resp;
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Error" }, { status: 403 });
  } finally {
    client.release();
  }
}


