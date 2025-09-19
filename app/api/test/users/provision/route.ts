import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { withGUC } from "@/lib/withGUC";

export const runtime = "nodejs";

type Body = {
  clerk_user_id: string;
  email?: string;
  organization_id?: string;
  orgnr?: string;
};

export async function POST(req: Request) {
  const secret = (req.headers.get("x-test-secret") || "").trim();
  const envSecret = (process.env.TEST_SEED_SECRET || "").trim();
  if (!secret || secret !== envSecret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: Body | null = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const clerkUserId = body?.clerk_user_id?.trim();
  const email = (body?.email || "").trim() || undefined;
  let orgId = body?.organization_id?.trim();
  const orgnr = body?.orgnr?.trim();
  if (!clerkUserId) {
    return NextResponse.json({ ok: false, error: "invalid_input", reason: "missing_clerk_user_id" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    if (!orgId && orgnr) {
      const r = await client.query<{ id: string }>(`select id from public.organizations where orgnr=$1 limit 1`, [orgnr]);
      orgId = r.rows[0]?.id;
      if (!orgId) {
        const ins = await client.query<{ id: string }>(
          `insert into public.organizations (orgnr, name) values ($1,$2)
           on conflict (orgnr) do update set name=excluded.name
           returning id`,
          [orgnr, `Org ${orgnr}`]
        );
        orgId = ins.rows[0]?.id;
      }
    }
    if (!orgId) {
      return NextResponse.json({ ok: false, error: "invalid_input", reason: "missing_organization" }, { status: 400 });
    }

    // Upsert user
    const u1 = await client.query<{ id: string }>(
      `select id from public.users where clerk_user_id=$1 limit 1`,
      [clerkUserId]
    );
    let userId = u1.rows[0]?.id;
    if (!userId) {
      const u2 = await client.query<{ id: string }>(
        `insert into public.users (clerk_user_id, primary_email, full_name, mfa_level)
         values ($1,$2,null,'none')
         on conflict (clerk_user_id) do update set primary_email=coalesce(excluded.primary_email, public.users.primary_email)
         returning id`,
        [clerkUserId, email || null]
      );
      userId = u2.rows[0]?.id;
    }
    if (!userId) {
      return NextResponse.json({ ok: false, error: "user_upsert_failed" }, { status: 500 });
    }

    await withGUC(client, { "request.user_id": userId, "request.org_id": orgId }, async () => {
      await client.query(
        `insert into public.user_org_selection (user_id, organization_id)
         values ($1,$2)
         on conflict (user_id) do update set organization_id=excluded.organization_id, updated_at=now()`,
        [userId, orgId]
      );
      await client.query(
        `insert into public.memberships (user_id, organization_id, role, status)
         values ($1,$2,'member','pending')
         on conflict (user_id, organization_id) do nothing`,
        [userId, orgId]
      );
    });

    return NextResponse.json({ ok: true, organization_id: orgId, user_id: userId });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  } finally {
    client.release();
  }
}


