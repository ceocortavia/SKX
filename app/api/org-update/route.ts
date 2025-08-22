import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { withGUC } from "@/lib/withGUC";
import { resolveOrgContext } from "@/lib/org-context";
import { pool } from "@/lib/db";
import { assertMFA } from "@/lib/assertMFA";

// Oppdater ufarlig felt: homepage_domain (RLS blokkerer BRREG-felt)
export async function POST(req: Request) {
  const { userId: clerkUserId } = auth();
  if (!clerkUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { homepage_domain } = body as { homepage_domain?: string };
  if (!homepage_domain) return NextResponse.json({ error: "Missing homepage_domain" }, { status: 400 });

  const client = await pool.connect();
  try {
    const u = await client.query(`select id, primary_email from public.users where clerk_user_id=$1`, [clerkUserId]);
    if (!u.rows[0]) return NextResponse.json({ error: "User not provisioned" }, { status: 403 });
    const userId: string = u.rows[0].id;
    const email: string = u.rows[0].primary_email;

    const { orgId, orgRole, orgStatus } = await resolveOrgContext(client, { userId });
    if (!orgId) return NextResponse.json({ error: "No organization context" }, { status: 400 });

    const mfa: "on" | "off" = (await assertMFA(10)) ? "on" : "off";
    if (mfa === "off") return NextResponse.json({ error: "MFA required" }, { status: 401 });

    const updated = await withGUC(
      { userId, clerkUserId, clerkUserEmail: email, orgId, orgRole, orgStatus, mfa },
      async (tx) => {
        const res = await tx.query(
          `update public.organizations set homepage_domain=$2 where id=$1 returning id, homepage_domain`,
          [orgId, homepage_domain]
        );
        return res.rows[0] ?? null;
      }
    );
    if (!updated) return NextResponse.json({ error: "No update" }, { status: 403 });
    return NextResponse.json({ updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Error" }, { status: 403 });
  } finally {
    client.release();
  }
}


