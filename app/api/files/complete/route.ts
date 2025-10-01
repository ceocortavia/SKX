import { NextResponse } from 'next/server';
import { getSession } from '@/server/authz';
import pool from '@/lib/db';
import { setRequestContext } from '@/server/request-context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const { orgId, userId } = await getSession(req);
    const body = await req.json().catch(() => ({}));
    const key = String(body?.key || '').trim();
    const name = String(body?.name || '').trim();
    const mime = String(body?.mime || '').trim();
    const bytes = Number(body?.bytes || 0);
    const spaceId = String(body?.space_id || '');
    const labels = Array.isArray(body?.labels) ? body.labels : [];
    if (!key || !name || !mime || !spaceId || !(bytes >= 0)) {
      return NextResponse.json({ ok: false, error: 'invalid_input' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await setRequestContext(client, { orgId, userId });
      const r = await client.query(`select 1 from public.spaces where id=$1 limit 1`, [spaceId]);
      if (!r.rowCount) return NextResponse.json({ ok: false, error: 'space_not_found' }, { status: 404 });

      const ins = await client.query<{ id: string }>(
        `insert into public.files (org_id, space_id, owner_user_id, name, mime, bytes, storage_key, labels)
         values ($1,$2,$3,$4,$5,$6,$7,$8)
         returning id`,
        [orgId, spaceId, userId, name, mime, bytes, key, JSON.stringify(labels)]
      );

      const fileId = ins.rows[0]?.id;
      if (!fileId) return NextResponse.json({ ok: false, error: 'insert_failed' }, { status: 500 });

      await client.query(
        `insert into public.audit (org_id, user_id, action, target_type, target_id)
         values ($1,$2,'file_complete','file',$3)`,
        [orgId, userId, fileId]
      );

      return NextResponse.json({ ok: true, file_id: fileId });
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'complete_error', message: e?.message || String(e) }, { status: 500 });
  }
}










