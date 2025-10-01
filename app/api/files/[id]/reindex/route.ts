import { NextResponse } from 'next/server';
import { getSession } from '@/server/authz';
import pool from '@/lib/db';
import { setRequestContext } from '@/server/request-context';
import { getObjectBody } from '@/lib/storage';
import { extractText, chunkText } from '@/lib/extract';
import { embedChunks } from '@/lib/embeddings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: fileId } = await params;
    if (!fileId) return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 });
    const { orgId, userId } = await getSession(_req);
    const client = await pool.connect();
    try {
      await setRequestContext(client, { orgId, userId });
      const r = await client.query<{ storage_key: string; name: string; mime: string }>(
        `select storage_key, name, mime from public.files where id=$1 limit 1`,
        [fileId]
      );
      if (!r.rowCount) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
      const { storage_key: key, name, mime } = r.rows[0];

      const bytes = await getObjectBody(key);
      const doc = await extractText(name, bytes, mime);
      const chunks = chunkText(doc.text);
      const vectors = await embedChunks(chunks);

      // Lagre metadata i file_index (uten vektor – lagres i ekstern index i M2b)
      await client.query('begin');
      await client.query(`delete from public.file_index where file_id=$1`, [fileId]);
      for (let i = 0; i < chunks.length; i++) {
        const md = { chunk: i, len: chunks[i].length } as any;
        await client.query(
          `insert into public.file_index (file_id, chunk_id, page, md) values ($1,$2,$3,$4)`,
          [fileId, `chunk-${i}`, null, JSON.stringify(md)]
        );
      }
      await client.query('commit');

      return NextResponse.json({ ok: true, chunks: chunks.length });
    } catch (e) {
      try { await client.query('rollback'); } catch {}
      throw e;
    } finally {
      client.release();
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'reindex_error', message: e?.message || String(e) }, { status: 500 });
  }
}


