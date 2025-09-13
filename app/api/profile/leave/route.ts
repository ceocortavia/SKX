import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { withGUC } from "@/lib/withGUC";
import { getAuthContext } from "@/lib/auth-context";

type Body = { organization_id: string };

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let body: Body | null = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const orgId = body?.organization_id;
  if (!orgId) return NextResponse.json({ ok: false, error: "invalid_input", reason: "missing_organization_id" }, { status: 400 });

  const client = await pool.connect();
  try {
    const ures = await client.query<{ id: string }>(
      `select id from public.users where clerk_user_id=$1 limit 1`,
      [auth.clerkUserId]
    );
    if (!ures.rowCount) return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
    const userUuid = ures.rows[0].id;

    const result = await withGUC(client, { "request.user_id": userUuid, "request.org_id": orgId }, async () => {
      const roleRes = await client.query<{ role: string }>(
        `select role from public.memberships where user_id = nullif(current_setting('request.user_id', true),'')::uuid and organization_id = nullif(current_setting('request.org_id', true),'')::uuid`
      );
      if (!roleRes.rowCount) return { canLeave: false as const, reason: "not_member" as const };
      if (roleRes.rows[0].role === "owner") return { canLeave: false as const, reason: "owner_cannot_leave" as const };

      await client.query(
        `delete from public.memberships where user_id = nullif(current_setting('request.user_id', true),'')::uuid and organization_id = nullif(current_setting('request.org_id', true),'')::uuid`
      );
      await client.query(
        `update public.user_org_selection set organization_id = null where user_id = nullif(current_setting('request.user_id', true),'')::uuid and organization_id = nullif(current_setting('request.org_id', true),'')::uuid`
      );
      return { canLeave: true as const };
    });

    if (!result.canLeave) {
      return NextResponse.json({ ok: false, error: "invalid_operation", reason: result.reason }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  } finally {
    client.release();
  }
}


