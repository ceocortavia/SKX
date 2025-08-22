import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { withGUC } from "@/lib/withGUC";
import { resolveOrgContext } from "@/lib/org-context";
import { pool } from "@/lib/db";

export async function POST(req: Request) {
  const { userId: clerkUserId } = auth();
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

    const { orgId, orgRole, orgStatus } = await resolveOrgContext(client, { userId });
    if (!orgId) return NextResponse.json({ error: "No organization context" }, { status: 400 });

    // Krev MFA=on for admin-operasjon (plugg inn faktisk sjekk her)
    const mfa: "on" | "off" = "on";

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

    return NextResponse.json({ created });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Error" }, { status: 403 });
  } finally {
    client.release();
  }
}


