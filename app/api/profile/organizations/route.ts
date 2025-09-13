import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { withGUC } from "@/lib/withGUC";
import { getAuthContext } from "@/lib/auth-context";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const client = await pool.connect();
  try {
    const ures = await client.query<{ id: string }>(
      `select id from public.users where clerk_user_id=$1 limit 1`,
      [auth.clerkUserId]
    );
    if (!ures.rowCount) return NextResponse.json({ ok: true, organizations: [] });
    const userUuid = ures.rows[0].id;

    const rows = await withGUC(client, { "request.user_id": userUuid }, async () => {
      const r = await client.query(
        `select
           o.id as organization_id,
           o.name as organization_name,
           o.orgnr,
           m.role
         from public.memberships m
         join public.organizations o on o.id = m.organization_id
         where m.user_id = nullif(current_setting('request.user_id', true),'')::uuid
         order by o.name asc`
      );
      return r.rows;
    });

    return NextResponse.json({ ok: true, organizations: rows });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  } finally {
    client.release();
  }
}


