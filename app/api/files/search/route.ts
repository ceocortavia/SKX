import { NextResponse } from 'next/server';
import { getSession } from '@/server/authz';
import pool from '@/lib/db';
import { setRequestContext } from '@/server/request-context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { orgId, userId } = await getSession(req);
    const url = new URL(req.url);
    const qRaw = (url.searchParams.get('q') || '').trim();
    const spaceId = url.searchParams.get('space_id');
    const requestedLimit = parseInt(url.searchParams.get('limit') || '10', 10);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 50)
      : 10;
    if (!qRaw) return NextResponse.json({ ok: true, hits: [] });

    const client = await pool.connect();
    try {
      await setRequestContext(client, { orgId, userId });
      const like = `%${qRaw.replace(/%/g, '')}%`;
      const params: any[] = [like];
      let sql = `
        select f.id as file_id, f.name, fi.chunk_id, fi.md
        from public.files f
        join public.file_index fi on fi.file_id = f.id
        where (f.name ilike $1 or (fi.md->>'text') ilike $1)
      `;
      if (spaceId) { sql += ` and f.space_id = $2`; params.push(spaceId); }
      params.push(limit);
      sql += ` order by f.updated_at desc limit $${params.length}`;
      const r = await client.query(sql, params);
      const hits = r.rows.map((row: any) => ({ file_id: row.file_id, name: row.name, citation: { chunk: row.chunk_id, md: row.md } }));
      return NextResponse.json({ ok: true, hits });
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'search_error', message: e?.message || String(e) }, { status: 500 });
  }
}









