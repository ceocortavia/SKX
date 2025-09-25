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
    if (!ures.rowCount) return NextResponse.json({ ok: true });
    const userId = ures.rows[0].id;
    const res = await withGUC(client, { "request.user_id": userId }, async () => {
      const r = await client.query<{ organization_id: string | null }>(
        `select organization_id from public.user_org_selection where user_id = nullif(current_setting('request.user_id', true),'')::uuid limit 1`
      );
      return r.rows[0]?.organization_id ?? null;
    });
    return NextResponse.json({ ok: true, organization_id: res });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let body: any = null;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const organizationId: string | undefined = body?.organization_id;
  const orgnr: string | undefined = body?.orgnr;
  if (!organizationId && !orgnr) {
    return NextResponse.json({ ok: false, error: "invalid_input", reason: "missing_org" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const ures = await client.query<{ id: string }>(
      `select id from public.users where clerk_user_id=$1 limit 1`,
      [auth.clerkUserId]
    );
    if (!ures.rowCount) return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
    const userId = ures.rows[0].id;

    // Resolve org id
    const orgRes = organizationId
      ? await client.query<{ id: string; orgnr: string | null; name: string | null }>(`select id, orgnr, name from public.organizations where id=$1 limit 1`, [organizationId])
      : await client.query<{ id: string; orgnr: string | null; name: string | null }>(`select id, orgnr, name from public.organizations where orgnr=$1 limit 1`, [orgnr]);
    if (!orgRes.rowCount) return NextResponse.json({ ok: false, error: "org_not_found" }, { status: 404 });
    const org = orgRes.rows[0];

    // Upsert user_org_selection and ensure membership exists (pending if new)
    await withGUC(client, { "request.user_id": userId }, async () => {
      await client.query(
        `insert into public.user_org_selection (user_id, organization_id, orgnr, org_name)
         values (nullif(current_setting('request.user_id', true),'')::uuid, $1, $2, $3)
         on conflict (user_id) do update set organization_id=excluded.organization_id, orgnr=excluded.orgnr, org_name=excluded.org_name, updated_at=now()`,
        [org.id, org.orgnr, org.name]
      );

      const m = await client.query(
        `select 1 from public.memberships where user_id=nullif(current_setting('request.user_id', true),'')::uuid and organization_id=$1 limit 1`,
        [org.id]
      );
      if (!m.rowCount) {
        await client.query(
          `insert into public.memberships (user_id, organization_id, role, status) values (nullif(current_setting('request.user_id', true),'')::uuid, $1, 'member', 'pending')`,
          [org.id]
        );
      }
    });

    const res = NextResponse.json({ ok: true, organization_id: org.id });
    try {
      res.cookies.set("orgId", org.id, {
        path: "/",
        httpOnly: false,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30,
      });
    } catch {}
    return res;
  } catch (e) {
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  } finally {
    client.release();
  }
}

