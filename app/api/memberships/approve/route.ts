import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { withGUC } from "@/lib/withGUC";
import { resolveOrgContext } from "@/lib/org-context";
import { pool } from "@/lib/db";
import { assertMFA } from "@/lib/assertMFA";
import { getOrgHint, setOrgCookie } from "@/lib/org-hint";
import { auditLog } from "@/lib/audit";

export async function POST(req: Request) {
  const { userId: clerkUserId } = auth();
  if (!clerkUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId: targetUserId } = (await req.json().catch(() => ({}))) as { userId?: string };
  if (!targetUserId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const client = await pool.connect();
  try {
    const u = await client.query(`select id, primary_email from public.users where clerk_user_id=$1`, [clerkUserId]);
    if (!u.rows[0]) return NextResponse.json({ error: "User not provisioned" }, { status: 403 });
    const userId: string = u.rows[0].id;
    const email: string = u.rows[0].primary_email;

    const { hintedOrgId } = getOrgHint(req);
    const { orgId, orgRole, orgStatus } = await resolveOrgContext(client, { userId, hintedOrgId });
    if (!orgId) return NextResponse.json({ error: "NO_ORG_CONTEXT" }, { status: 400 });
    if (!(orgRole === "admin" || orgRole === "owner") || orgStatus !== "approved") {
      return NextResponse.json({ error: "NOT_ALLOWED" }, { status: 403 });
    }

    const mfa: "on" | "off" = (await assertMFA(10)) ? "on" : "off";
    if (mfa === "off") return NextResponse.json({ error: "MFA required" }, { status: 401 });

    const result = await withGUC(
      { userId, clerkUserId, clerkUserEmail: email, orgId, orgRole, orgStatus, mfa },
      async (tx) => {
        const upd = await tx.query(
          `update public.memberships set status='approved'
           where organization_id=$1 and user_id=$2 and status<>'approved' returning user_id, organization_id, role, status`,
          [orgId, targetUserId]
        );
        if (upd.rowCount > 0) {
          await auditLog(tx, {
            actorUserId: userId,
            actorOrgId: orgId,
            action: "membership.approve",
            targetTable: "memberships",
            targetPk: targetUserId,
            metadata: { by: orgRole },
          });
        }
        return { updated: upd.rowCount, membership: upd.rows[0] ?? null };
      }
    );

    const res = NextResponse.json(result);
    res.headers.set("x-org-id", orgId);
    setOrgCookie(orgId);
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Error" }, { status: 403 });
  } finally {
    client.release();
  }
}


