import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import pool from "@/lib/db";
import { withGUC } from "@/lib/withGUC";
import { getAuthContext } from "@/lib/auth-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req as any);
  const jar = cookies();
  const cookieOrgId = jar.get("orgId")?.value || null;

  let orgId: string | null = cookieOrgId;
  const client = await pool.connect();
  try {
    if (!orgId && auth?.clerkUserId) {
      const ures = await client.query<{ id: string }>(
        `select id from public.users where clerk_user_id=$1 limit 1`,
        [auth.clerkUserId]
      );
      const userId = ures.rows[0]?.id;
      if (userId) {
        const r = await withGUC(client, { "request.user_id": userId }, async () => {
          const q = await client.query<{ organization_id: string | null }>(
            `select organization_id from public.user_org_selection where user_id = nullif(current_setting('request.user_id', true),'')::uuid limit 1`
          );
          return q.rows[0]?.organization_id ?? null;
        });
        orgId = r;
      }
    }

    if (!orgId) return NextResponse.json({ orgId: null });

    const orgRes = await client.query(
      `select id, name as display_name, name as legal_name, orgnr, status, homepage_domain from public.organizations where id=$1 limit 1`,
      [orgId]
    );
    if (!orgRes.rowCount) return NextResponse.json({ orgId: null });
    return NextResponse.json({ orgId, org: orgRes.rows[0] }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ orgId: null });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req as any);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body: any = await req.json().catch(() => ({}));
  const byId: string | null = body?.organization_id ? String(body.organization_id) : null;
  const byOrg: string | null = body?.orgnr && /^\d{9}$/.test(String(body.orgnr)) ? String(body.orgnr) : null;
  if (!byId && !byOrg) return NextResponse.json({ error: "organization_id_or_orgnr_required" }, { status: 422 });

  const client = await pool.connect();
  try {
    // Resolve user id
    const ures = await client.query<{ id: string }>(
      `select id from public.users where clerk_user_id=$1 limit 1`,
      [auth.clerkUserId]
    );
    const userId = ures.rows[0]?.id;
    if (!userId) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

    // Resolve org
    const orgRes = byId
      ? await client.query<{ id: string }>(`select id from public.organizations where id=$1 limit 1`, [byId])
      : await client.query<{ id: string }>(`select id from public.organizations where orgnr=$1 limit 1`, [byOrg]);
    if (!orgRes.rowCount) return NextResponse.json({ error: "org_not_found" }, { status: 404 });
    const resolvedOrgId = orgRes.rows[0].id;

    // Ensure pending membership if missing
    await client.query(
      `insert into public.memberships (user_id, organization_id, role, status)
       values ($1,$2,'member','pending')
       on conflict (user_id, organization_id) do nothing`,
      [userId, resolvedOrgId]
    );

    // Update selection via GUC for RLS correctness
    await withGUC(client, { "request.user_id": userId }, async () => {
      await client.query(
        `insert into public.user_org_selection (user_id, organization_id)
         values (nullif(current_setting('request.user_id', true),'')::uuid, $1)
         on conflict (user_id) do update set organization_id=excluded.organization_id, updated_at=now()`,
        [resolvedOrgId]
      );
    });

    // Set HttpOnly cookie
    const jar = cookies();
    jar.set("orgId", resolvedOrgId, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    // RLS GUC for current request
    await client.query(`select set_config('request.org_id',$1,true)`, [resolvedOrgId]);

    return NextResponse.json({ ok: true, orgId: resolvedOrgId }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  } finally {
    client.release();
  }
}

