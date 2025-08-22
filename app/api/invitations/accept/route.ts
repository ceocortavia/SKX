import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { withGUC } from "@/lib/withGUC";
import { resolveOrgContext } from "@/lib/org-context";
import { pool } from "@/lib/db";
import { getOrgHint, setOrgCookie } from "@/lib/org-hint";
import { auditLog } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(req: Request) {
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
    if (!orgId) return NextResponse.json({ error: "NO_ORG_CONTEXT" }, { status: 400 });

    const result = await withGUC(
      { userId, clerkUserId, clerkUserEmail: email, orgId, orgRole, orgStatus, mfa: "off" },
      async (tx) => {
        // 1) Accept invitation for this email
        const upd = await tx.query(
          `update public.invitations set status='accepted'
           where organization_id=$1 and email=$2 and status='pending'
           returning id, email, status`,
          [orgId, email]
        );

        // 2) Ensure membership exists (create if missing)
        let membership = null as any;
        if (upd.rowCount > 0) {
          const msel = await tx.query(
            `select user_id, organization_id, role, status from public.memberships where organization_id=$1 and user_id=$2`,
            [orgId, userId]
          );
          if (!msel.rows[0]) {
            const mins = await tx.query(
              `insert into public.memberships (user_id, organization_id, role, status, approved_by, approved_at)
               values ($1,$2,'member','pending',null,null)
               returning user_id, organization_id, role, status`,
              [userId, orgId]
            );
            membership = mins.rows[0];
          } else {
            membership = msel.rows[0];
          }

          await auditLog(tx, {
            actorUserId: userId,
            actorOrgId: orgId,
            action: "invite.accept",
            targetTable: "invitations",
            targetPk: upd.rows[0].id,
            metadata: { email },
          });
        }
        return { accepted: upd.rowCount, membership };
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


