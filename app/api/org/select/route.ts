import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: Request) {
  const { orgnr } = await req.json().catch(() => ({} as any));
  if (!/^\d{9}$/.test(orgnr ?? "")) {
    return NextResponse.json({ ok: false, error: "invalid_orgnr" }, { status: 400 });
  }
  const client = await pool.connect();
  try {
    const existing = await client.query(
      `select id, orgnr, name from public.organizations where orgnr=$1`,
      [orgnr]
    );
    let orgId: string | undefined = existing.rows[0]?.id;

    if (!orgId) {
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


