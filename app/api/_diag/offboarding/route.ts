import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Diagnostics endpoint for offboarding system
 * Returns: run counts, completion times, recent errors
 * 
 * Usage: GET /api/_diag/offboarding
 */
export async function GET() {
  const client = await pool.connect();
  try {
    // Runs in last 24 hours
    const statsRes = await client.query<{
      total_runs: string;
      completed_runs: string;
      processing_runs: string;
      failed_runs: string;
      avg_completion_ms: string;
    }>(`
      select 
        count(*) filter (where created_at > now() - interval '24 hours') as total_runs,
        count(*) filter (where status = 'completed' and created_at > now() - interval '24 hours') as completed_runs,
        count(*) filter (where status = 'processing' and created_at > now() - interval '24 hours') as processing_runs,
        count(*) filter (where status not in ('completed', 'processing') and created_at > now() - interval '24 hours') as failed_runs,
        coalesce(
          avg(extract(epoch from (updated_at - created_at)) * 1000) 
          filter (where status = 'completed' and created_at > now() - interval '24 hours'),
          0
        )::int as avg_completion_ms
      from public.offboarding_runs
    `);

    const stats = statsRes.rows[0];

    // Recent runs (last 10)
    const recentRes = await client.query<{
      id: string;
      status: string;
      created_at: string;
      updated_at: string;
      duration_ms: number;
      artifact_count: number;
      candidate_files_count: number;
    }>(`
      select 
        id,
        status,
        created_at,
        updated_at,
        extract(epoch from (updated_at - created_at)) * 1000 as duration_ms,
        jsonb_object_keys(artifacts)::text[] as artifact_keys,
        coalesce(array_length(candidate_files, 1), 0) as candidate_files_count,
        (
          select count(*) 
          from jsonb_object_keys(artifacts)
        ) as artifact_count
      from public.offboarding_runs
      order by created_at desc
      limit 10
    `);

    // Transition spaces count
    const spacesRes = await client.query<{ count: string }>(`
      select count(*) as count
      from public.spaces
      where type = 'transition'
    `);

    // Artifact files count
    const artifactsRes = await client.query<{ count: string }>(`
      select count(*) as count
      from public.files
      where storage_key like 'transition/%'
    `);

    return NextResponse.json({
      ok: true,
      ts: new Date().toISOString(),
      stats: {
        last_24h: {
          total: parseInt(stats.total_runs, 10),
          completed: parseInt(stats.completed_runs, 10),
          processing: parseInt(stats.processing_runs, 10),
          failed: parseInt(stats.failed_runs, 10),
          avg_completion_ms: parseInt(stats.avg_completion_ms, 10),
        },
        all_time: {
          transition_spaces: parseInt(spacesRes.rows[0].count, 10),
          artifact_files: parseInt(artifactsRes.rows[0].count, 10),
        },
      },
      recent_runs: recentRes.rows.map((r) => ({
        id: r.id,
        status: r.status,
        created_at: r.created_at,
        updated_at: r.updated_at,
        duration_ms: Math.round(r.duration_ms),
        candidate_files: r.candidate_files_count,
        artifacts: r.artifact_count,
      })),
      mode: process.env.ENABLE_DB_ONLY_ARTIFACTS === '1' ? 'db-only' : 's3',
      flags: {
        api_enabled: process.env.ENABLE_OFFBOARDING_API === '1',
        ui_enabled: process.env.NEXT_PUBLIC_OFFBOARDING_ENABLED === '1',
        db_only: process.env.ENABLE_DB_ONLY_ARTIFACTS === '1',
      },
    });
  } catch (e: any) {
    console.error('[diag.offboarding]', e);
    return NextResponse.json({
      ok: false,
      error: 'diag_exception',
      message: e?.message || String(e),
      ts: new Date().toISOString(),
    }, { status: 500 });
  } finally {
    client.release();
  }
}



