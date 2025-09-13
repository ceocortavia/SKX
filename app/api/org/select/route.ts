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

    cookies().set("orgId", orgId!, { path: "/", httpOnly: true });
    return NextResponse.json({ ok: true, organization_id: orgId });
  } catch (err) {
    console.error("[org.select]", err);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  } finally {
    client.release();
  }
}


