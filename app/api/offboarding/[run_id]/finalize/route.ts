import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { withGUC } from '@/lib/withGUC';
import { getAuthContext } from '@/lib/auth-context';
import { resolveOrgContext } from '@/lib/org-context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ArtifactDefinition {
  key: string;
  name: string;
  mime: string;
  content: string;
}

function buildArtifacts(userEmail: string, candidateCount: number): ArtifactDefinition[] {
  const generatedAt = new Date().toISOString();
  return [
    {
      key: 'playbook',
      name: 'Playbook.md',
      mime: 'text/markdown',
      content: `# Offboarding Playbook for ${userEmail}\n\n## Overlevering\n\nDette dokumentet inneholder viktig informasjon for overlevering av arbeidsoppgaver.\n\n### Aktive prosjekter\n- Prosjekt A: Status og neste steg\n- Prosjekt B: Kontaktpersoner og deadlines\n\n### Systemtilganger\n- System 1: Brukernavn og tilganger\n- System 2: Passord og tilgangsnivå\n\n### Kontaktinformasjon\n- Interne kontakter: Navn og telefon\n- Eksterne kontakter: Leverandører og kunder\n\nGenerert: ${generatedAt}`,
    },
    {
      key: 'faq',
      name: 'FAQ.md',
      mime: 'text/markdown',
      content: `# FAQ - Offboarding for ${userEmail}\n\n## Ofte stilte spørsmål\n\n### Hvor finner jeg dokumentasjon?\nDokumentasjon ligger i Transition Space og kan søkes gjennom systemet.\n\n### Hvem tar over ansvaret?\nKontakt HR eller nærmeste leder for informasjon om overlevering.\n\n### Hvor lenge er data tilgjengelig?\nData er tilgjengelig i 90 dager etter offboarding.\n\nGenerert: ${generatedAt}`,
    },
    {
      key: 'summary',
      name: 'Oppsummering.csv',
      mime: 'text/csv',
      content: `filnummer,navn,type,storrelse,opprettet,space\n${candidateCount} filer identifisert for overføring`,
    },
  ];
}

export async function POST(
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

      const dbOnlyMode = process.env.ENABLE_DB_ONLY_ARTIFACTS === '1';
      if (!dbOnlyMode) {
        return NextResponse.json({ error: 's3_mode_not_supported' }, { status: 501 });
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
          candidate_files: string[];
          artifacts: Record<string, unknown>;
          user_email: string;
        }>(
          `select o.id,
                  o.org_id,
                  o.user_id,
                  o.status,
                  o.candidate_files,
                  o.artifacts,
                  u.primary_email as user_email
             from public.offboarding_runs o
             join public.users u on u.id = o.user_id
            where o.id = $1 and o.org_id = $2
            for update`,
          [run_id, org.id]
        );

        const run = runRes.rows[0];
        if (!run) {
          return NextResponse.json({ error: 'run_not_found' }, { status: 404 });
        }

        if (run.status === 'completed') {
          return NextResponse.json({ error: 'run_already_completed' }, { status: 400 });
        }

        if (run.status !== 'processing') {
          return NextResponse.json({ error: 'invalid_status', status: run.status }, { status: 400 });
        }

        const artifacts = buildArtifacts(run.user_email, run.candidate_files?.length ?? 0);
        const spaceName = `Transition-${run.user_email}-${new Date().toISOString().split('T')[0]}`;

        const spaceRes = await client.query<{
          id: string;
          name: string;
          type: string;
          created_at: string;
        }>(
          `insert into public.spaces (org_id, type, name, owner_user_id)
           values ($1, 'transition', $2, $3)
           returning id, name, type, created_at`,
          [run.org_id, spaceName, internalUserId]
        );

        const transitionSpace = spaceRes.rows[0];
        const artifactFiles: Array<{ id: string; name: string }> = [];
        const artifactSummary: Record<string, unknown> = {};

        for (const artifact of artifacts) {
          const storageKey = `transition/${transitionSpace.id}/${artifact.key}-${Date.now()}`;
          const insertRes = await client.query<{
            id: string;
            name: string;
          }>(
            `insert into public.files (org_id, space_id, owner_user_id, name, mime, bytes, storage_key, labels)
             values ($1, $2, $3, $4, $5, $6, $7, $8)
             returning id, name`,
            [
              run.org_id,
              transitionSpace.id,
              internalUserId,
              artifact.name,
              artifact.mime,
              Buffer.byteLength(artifact.content, 'utf8'),
              storageKey,
              JSON.stringify(['offboarding', 'generated', artifact.key]),
            ]
          );

          const fileRow = insertRes.rows[0];
          artifactFiles.push(fileRow);

          await client.query(
            `insert into public.file_index (file_id, chunk_id, page, md)
             values ($1, $2, NULL, $3::jsonb)`,
            [
              fileRow.id,
              `artifact-${artifact.key}`,
              JSON.stringify({
                text: artifact.content,
                type: 'artifact',
                artifact_type: artifact.key,
              }),
            ]
          );

          artifactSummary[artifact.key] = {
            file_id: fileRow.id,
            name: artifact.name,
            storage_key: storageKey,
          };
        }

        await client.query(
          `update public.offboarding_runs
              set status = 'completed',
                  transition_space_id = $1,
                  artifacts = $2,
                  updated_at = now()
            where id = $3`,
          [transitionSpace.id, JSON.stringify(artifactSummary), run.id]
        );

        await client.query(
          `insert into public.audit (org_id, user_id, action, target_type, target_id)
           values ($1, $2, 'offboarding_completed', 'offboarding_run', $3)`,
          [run.org_id, internalUserId, run.id]
        );

        return NextResponse.json({
          run_id: run.id,
          status: 'completed',
          mode: 'db-only',
          transition_space: transitionSpace,
          artifacts: artifactFiles,
          completed_at: new Date().toISOString(),
        });
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[offboarding.finalize]', error);
    return NextResponse.json({
      error: 'internal_error',
      message: error?.message || String(error),
    }, { status: 500 });
  }
}
