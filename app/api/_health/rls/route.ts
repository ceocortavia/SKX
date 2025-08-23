import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  const client = await pool.connect();
  try {
    // Ingen GUC-sett her. Health skal reflektere "null context".
    // 1) Hent policy-snapshot
    const pol = await client.query(
      `select tablename, policyname, cmd, coalesce(qual::text,'') as qual, coalesce(with_check::text,'') as with_check
       from pg_policies where schemaname='public'
       order by tablename, policyname`
    );

    // 2) Sanity anonym-RLS (simuler app_client uten GUC)
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE app_client');
    const u = await client.query('select count(*)::int as n from public.users');
    const o = await client.query('select count(*)::int as n from public.organizations');
    await client.query('ROLLBACK');

    const body = {
      ok: true,
      anonRls: { users: u.rows[0]?.n ?? 0, organizations: o.rows[0]?.n ?? 0 },
      policies: pol.rows,
      context: {
        user_id: null,
        org_id: null,
        role: null,
        status: null,
        mfa: 'off',
      },
    };
    return NextResponse.json(body);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? 'error' }, { status: 500 });
  } finally {
    client.release();
  }
}


