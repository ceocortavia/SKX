import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { withGUC } from "@/lib/withGUC";
import { resolveOrgContext } from "@/lib/org-context";
import { pool } from "@/lib/db";

export async function GET(req: Request) {
  const { userId: clerkUserId } = auth();
  if (!clerkUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await pool.connect();
  try {
    const ures = await client.query(
      `select id, primary_email from public.users where clerk_user_id = $1`,
      [clerkUserId]
    );
    if (!ures.rows[0]) {
      return NextResponse.json({ error: "User not provisioned" }, { status: 403 });
    }
    const userId: string = ures.rows[0].id;
    const email: string = ures.rows[0].primary_email;

    const url = new URL(req.url);
    const hintedOrgId = url.searchParams.get("orgId");
    const { orgId, orgRole, orgStatus } = await resolveOrgContext(client, { userId, hintedOrgId });

    const mfa: "on" | "off" = "off";

    const data = await withGUC(
      { userId, clerkUserId, clerkUserEmail: email, orgId, orgRole, orgStatus, mfa },
      async (tx) => {
        const me = await tx.query(
          `select id, primary_email, full_name from public.users where id = $1`,
          [userId]
        );
        const org = orgId
          ? await tx.query(
              `select id, orgnr, name, homepage_domain from public.organizations where id = $1`,
              [orgId]
            )
          : { rows: [] };
        return { me: me.rows[0], org: org.rows[0] ?? null, role: orgRole, status: orgStatus };
      }
    );

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Error" }, { status: 500 });
  } finally {
    client.release();
  }
}


