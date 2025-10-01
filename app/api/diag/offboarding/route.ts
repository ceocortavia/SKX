import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Public diagnostics endpoint for offboarding system
 * Returns: run counts, completion times, recent errors
 * 
 * Usage: GET /api/diag/offboarding
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
      user_email: string;
      created_at: string;
      updated_at: string;
      duration_ms: number;
      artifact_count: number;
      candidate_files_count: number;
      error_code?: string;
    }>(`
      select 
        r.id,
        r.status,
        u.primary_email as user_email,
        r.created_at,
        r.updated_at,
        extract(epoch from (r.updated_at - r.created_at)) * 1000 as duration_ms,
        coalesce(array_length(r.candidate_files, 1), 0) as candidate_files_count,
        jsonb_array_length(
          case when jsonb_typeof(r.artifacts) = 'array' then r.artifacts else '[]'::jsonb end
        ) as artifact_count,
        (r.result->>'error_code')::text as error_code
      from public.offboarding_runs r
      left join public.users u on u.id = r.user_id
      order by r.created_at desc
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

    // Last error (if any)
    const lastErrorRes = await client.query<{
      id: string;
      status: string;
      error_code: string;
      created_at: string;
    }>(`
      select 
        id, 
        status,
        (result->>'error_code')::text as error_code,
        created_at
      from public.offboarding_runs
      where status not in ('completed', 'processing')
        and created_at > now() - interval '24 hours'
      order by created_at desc
      limit 1
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
      last_error: lastErrorRes.rows[0] || null,
      recent_runs: recentRes.rows.map((r) => ({
        id: r.id,
        status: r.status,
        user_email: r.user_email,
        created_at: r.created_at,
        updated_at: r.updated_at,
        duration_ms: Math.round(r.duration_ms),
        candidate_files: r.candidate_files_count,
        artifacts: r.artifact_count,
        error_code: r.error_code || null,
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

