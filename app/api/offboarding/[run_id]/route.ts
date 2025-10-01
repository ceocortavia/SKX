import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { withGUC } from '@/lib/withGUC';
import { getAuthContext } from '@/lib/auth-context';
import { resolveOrgContext } from '@/lib/org-context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ run_id: string }> }
) {
  try {
    if (process.env.ENABLE_OFFBOARDING_API === '0') {
      return NextResponse.json({ error: 'offboarding_disabled' }, { status: 403 });
    }

    const { run_id } = await params;
    if (!run_id || typeof run_id !== 'string') {
      return NextResponse.json({ error: 'missing_run_id' }, { status: 400 });
    }

    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const client = await pool.connect();
    try {
      const { userId: internalUserId, org } = await resolveOrgContext(client, auth.clerkUserId, req);
      if (!org) {
        return NextResponse.json({ error: 'org_not_found' }, { status: 403 });
      }

      return await withGUC(client, {
        'request.clerk_user_id': auth.clerkUserId,
        'request.user_id': internalUserId,
        'request.org_id': org.id,
        'request.org_role': org.role,
        'request.org_status': org.status,
        'request.mfa': auth.mfaVerified ? 'on' : 'off',
      }, async () => {
        const runRes = await client.query<{
          id: string;
          org_id: string;
          user_id: string;
          status: string;
          created_at: string;
          updated_at: string;
          candidate_files: string[];
          transition_space_id: string | null;
          artifacts: Record<string, unknown>;
          user_email: string;
        }>(
          `select o.id,
                  o.org_id,
                  o.user_id,
                  o.status,
                  o.created_at,
                  o.updated_at,
                  o.candidate_files,
                  o.transition_space_id,
                  o.artifacts,
                  u.primary_email as user_email
             from public.offboarding_runs o
             join public.users u on u.id = o.user_id
            where o.id = $1 and o.org_id = $2
            limit 1`,
          [run_id, org.id]
        );

        const run = runRes.rows[0];
        if (!run) {
          return NextResponse.json({ error: 'run_not_found' }, { status: 404 });
        }

        let candidateFilesDetails: Array<{
          id: string;
          name: string;
          space_name: string;
          space_type: string;
          created_at: string;
          bytes: number;
          mime: string;
        }> = [];

        if (run.candidate_files && run.candidate_files.length > 0) {
          const filesRes = await client.query<{
            id: string;
            name: string;
            space_name: string;
            space_type: string;
            created_at: string;
            bytes: number;
            mime: string;
          }>(
            `select f.id,
                    f.name,
                    s.name as space_name,
                    s.type as space_type,
                    f.created_at,
                    f.bytes,
                    f.mime
               from public.files f
               join public.spaces s on s.id = f.space_id
              where f.id = any($1::uuid[])
              order by f.created_at desc`,
            [run.candidate_files]
          );
          candidateFilesDetails = filesRes.rows;
        }

        let transitionSpace: { id: string; name: string; type: string; created_at: string } | null = null;
        if (run.transition_space_id) {
          const spaceRes = await client.query<{
            id: string;
            name: string;
            type: string;
            created_at: string;
          }>(
            `select id, name, type, created_at
               from public.spaces
              where id = $1
              limit 1`,
            [run.transition_space_id]
          );
          transitionSpace = spaceRes.rows[0] ?? null;
        }

        return NextResponse.json({
          run_id: run.id,
          user_id: run.user_id,
          user_email: run.user_email,
          status: run.status,
          created_at: run.created_at,
          updated_at: run.updated_at,
          candidate_files: candidateFilesDetails,
          transition_space: transitionSpace,
          artifacts: run.artifacts ?? {},
        });
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[offboarding.get]', error);
    return NextResponse.json({
      error: 'internal_error',
      message: error?.message || String(error),
    }, { status: 500 });
  }
}
