import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSession } from '@/server/authz';
import pool from '@/lib/db';
import { setRequestContext } from '@/server/request-context';
import { createPresignedPut } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const { orgId, userId } = await getSession(req);
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name || '').trim();
    const mime = String(body?.mime || '').trim();
    const bytes = Number(body?.bytes || 0);
    const spaceId = String(body?.space_id || '');
    if (!name || !mime || !spaceId || !(bytes >= 0)) {
      return NextResponse.json({ ok: false, error: 'invalid_input' }, { status: 400 });
    }
    const key = `${orgId}/${randomUUID()}/${encodeURIComponent(name)}`;
    const { url } = await createPresignedPut(key, mime, 900);

    // valider at space tilhører org (RLS: set context og sjekk exists)
    const client = await pool.connect();
    try {
      await setRequestContext(client, { orgId, userId });
      const r = await client.query(`select 1 from public.spaces where id=$1 limit 1`, [spaceId]);
      if (!r.rowCount) return NextResponse.json({ ok: false, error: 'space_not_found' }, { status: 404 });
    } finally {
      client.release();
    }

    return NextResponse.json({ ok: true, url, key });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'presign_error', message: e?.message || String(e) }, { status: 500 });
  }
}










