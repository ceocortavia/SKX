import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { withGUC } from "@/lib/withGUC";
import { resolveOrgContext } from "@/lib/org-context";
import { pool } from "@/lib/db";
import { assertMFA } from "@/lib/assertMFA";
import { getOrgHint, setOrgCookie } from "@/lib/org-hint";

export async function POST(req: Request) {
  const { clerkUserId } = await getAuthContext(req);
  if (!clerkUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { domain } = body as { domain?: string };
  if (!domain) return NextResponse.json({ error: "Missing domain" }, { status: 400 });

  const client = await pool.connect();
  try {
    const u = await client.query(`select id, primary_email from public.users where clerk_user_id=$1`, [clerkUserId]);
    if (!u.rows[0]) return NextResponse.json({ error: "User not provisioned" }, { status: 403 });
    const userId: string = u.rows[0].id;
    const email: string = u.rows[0].primary_email;

    const { hintedOrgId } = getOrgHint(req);
    const { orgId, orgRole, orgStatus } = await resolveOrgContext(client, { userId, hintedOrgId });
    if (!orgId) return NextResponse.json({ error: "No organization context" }, { status: 400 });

    // Krev MFA=on for admin-operasjon
    const mfa: "on" | "off" = (await assertMFA(10)) ? "on" : "off";
    if (mfa === "off") {
      return NextResponse.json({ error: "MFA required" }, { status: 401 });
    }

    const created = await withGUC(
      { userId, clerkUserId, clerkUserEmail: email, orgId, orgRole, orgStatus, mfa },
      async (tx) => {
        const ins = await tx.query(
          `insert into public.organization_domains (organization_id, domain, verified)
           values ($1, $2, false)
           returning id, domain, verified`,
          [orgId, domain]
        );
        return ins.rows[0];
      }
    );

    const res = NextResponse.json({ created });
    if (orgId) {
      res.headers.set("x-org-id", orgId);
      setOrgCookie(res, orgId);
    }
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Error" }, { status: 403 });
  } finally {
    client.release();
  }
}

export async function GET(req: Request) {
  try {
    const { clerkUserId } = await getAuthContext(req);
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

      const data = await withGUC(
        { userId, clerkUserId, clerkUserEmail: email, orgId, orgRole, orgStatus, mfa: "off" },
        async (tx) => {
          const res = await tx.query(
            `select id, domain, verified, created_at, updated_at
             from public.organization_domains
             where organization_id=$1
             order by domain asc`,
            [orgId]
          );
          return res.rows;
        }
      );

      const resp = NextResponse.json({ domains: data });
      resp.headers.set("x-org-id", orgId);
      setOrgCookie(resp, orgId);
      return resp;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("GET /api/org-domains failed:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}


