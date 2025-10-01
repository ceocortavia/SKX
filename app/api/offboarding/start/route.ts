import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import pool from '@/lib/db';
import { getAuthContext } from '@/lib/auth-context';
import { resolveOrgContext } from '@/lib/org-context';
import { withGUC } from '@/lib/withGUC';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  user_email: z.string().email(),
});

export async function POST(req: NextRequest) {
  try {
    if (process.env.ENABLE_OFFBOARDING_API === '0') {
      return NextResponse.json({ error: 'offboarding_disabled' }, { status: 403 });
    }

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
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
        const { user_email } = parsed.data;

        const targetRes = await client.query<{
          id: string;
          primary_email: string;
        }>(
          `select u.id, u.primary_email
             from public.users u
             join public.memberships m on m.user_id = u.id
            where m.organization_id = $1
              and m.status = 'approved'
              and lower(u.primary_email) = lower($2)
            limit 1`,
          [org.id, user_email]
        );

        const target = targetRes.rows[0];
        if (!target) {
          return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
        }

        const runRes = await client.query<{
          id: string;
          status: string;
          created_at: string;
          updated_at: string;
          candidate_files: string[];
          artifacts: Record<string, unknown>;
        }>(
          `insert into public.offboarding_runs (org_id, user_id, started_by, status)
           values ($1, $2, $3, 'processing')
           returning id, status, created_at, updated_at, candidate_files, artifacts`,
          [org.id, target.id, internalUserId]
        );

        const run = runRes.rows[0];

        return NextResponse.json({
          run_id: run.id,
          user_id: target.id,
          user_email: target.primary_email,
          status: run.status,
          created_at: run.created_at,
          updated_at: run.updated_at,
          candidate_files: run.candidate_files ?? [],
          transition_space: null,
          artifacts: run.artifacts ?? {},
        }, { status: 201 });
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[offboarding.start]', error);
    return NextResponse.json({
      error: 'internal_error',
      message: error?.message || String(error),
    }, { status: 500 });
  }
}
