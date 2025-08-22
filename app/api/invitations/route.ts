import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { withGUC } from "@/lib/withGUC";
import { resolveOrgContext } from "@/lib/org-context";
import { pool } from "@/lib/db";
import { assertMFA } from "@/lib/assertMFA";
import { getOrgHint, setOrgCookie } from "@/lib/org-hint";
import { auditLog } from "@/lib/audit";
import { getOrgHint, setOrgCookie } from "@/lib/org-hint";

export async function POST(req: Request) {
  const { userId: clerkUserId } = auth();
  if (!clerkUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { email?: string; requested_role?: "member" | "admin"; expires_days?: number };
  const emailParam = body.email?.trim();
  const requestedRole = body.requested_role ?? "member";
  const expiresDays = Math.max(1, Math.min(30, body.expires_days ?? 7));
  if (!emailParam) return NextResponse.json({ error: "Missing email" }, { status: 400 });

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
        const ins = await tx.query(
          `insert into public.invitations (organization_id,email,requested_role,status,expires_at)
           values ($1,$2,$3,'pending', now()+($4||' days')::interval)
           returning id, organization_id, email, requested_role, status, expires_at`,
          [orgId, emailParam, requestedRole, String(expiresDays)]
        );
        await auditLog(tx, {
          actorUserId: userId,
          actorOrgId: orgId,
          action: "invite.create",
          targetTable: "invitations",
          targetPk: ins.rows[0].id,
          metadata: { requestedRole },
        });
        return { invitation: ins.rows[0] };
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

export async function GET(req: Request) {
  const { userId: clerkUserId } = auth();
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
          `select id, organization_id, email, requested_role, status, expires_at
           from public.invitations
           where ($1::uuid is not null and organization_id=$1)
              or (email=$2)
           order by created_at desc nulls last
           limit 100`,
          [orgId ?? null, email]
        );
        return res.rows;
      }
    );

    const resp = NextResponse.json({ invitations: data });
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


