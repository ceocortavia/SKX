import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAuthContext } from "@/lib/auth-context";
import { withGUC } from "@/lib/withGUC";

export async function POST(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as any));
  const orgnr: string | undefined = body?.orgnr;
  const organizationIdInput: string | undefined = body?.organization_id;
  if (!organizationIdInput && !/^\d{9}$/.test(orgnr ?? "")) {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }
  const client = await pool.connect();
  try {
    let orgId: string | undefined = organizationIdInput;
    let existing: any = { rows: [] as any[] };

    if (!orgId && orgnr) {
      existing = await client.query(
        `select id, orgnr, name from public.organizations where orgnr=$1`,
        [orgnr]
      );
      orgId = existing.rows[0]?.id;
    }

    if (!orgId && orgnr) {
      const cache = await client.query(
        `select orgnr, name from public.brreg_cache where orgnr=$1`,
        [orgnr]
      );
      const name = cache.rows[0]?.name ?? `Org ${orgnr}`;
      const ins = await client.query(
        `insert into public.organizations (orgnr, name)
         values ($1,$2)
         on conflict (orgnr) do update set name=excluded.name
         returning id`,
        [orgnr, name]
      );
      orgId = ins.rows[0].id as string;
    }

    // Persistér valget i user_org_selection under RLS via GUC
    const userRes = await client.query(
      `select id from public.users where clerk_user_id=$1`,
      [auth.clerkUserId]
    );
    const userId: string | undefined = userRes.rows[0]?.id;

    if (userId && orgId) {
      await withGUC(client, {
        "request.clerk_user_id": auth.clerkUserId,
        "request.user_id": userId,
        "request.org_id": orgId,
      }, async () => {
        const org = existing.rows[0] ?? { orgnr, name: undefined };
        await client.query(
          `insert into public.user_org_selection (user_id, organization_id, orgnr, org_name)
           values ($1,$2,$3,$4)
           on conflict (user_id) do update set
             organization_id=excluded.organization_id,
             orgnr=excluded.orgnr,
             org_name=excluded.org_name,
             updated_at=now()`,
          [userId, orgId, org.orgnr ?? orgnr, org.name ?? null]
        );
      });
    }

    const res = NextResponse.json({ ok: true, organization_id: orgId });
    res.cookies.set("orgId", orgId!, { path: "/", httpOnly: true });
    return res;
  } catch (err) {
    console.error("[org.select]", err);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function GET() {
  try {
    const jar = await cookies();
    const orgId = jar.get("orgId")?.value || null;
    return NextResponse.json({ organization_id: orgId });
  } catch (err) {
    return NextResponse.json({ organization_id: null });
  }
}


