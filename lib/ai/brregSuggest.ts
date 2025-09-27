import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { executeAiRun } from './run';
import { hashInput } from './hash';
import type { BrregOrgDetails } from '../brreg';

export interface OrganizationRow {
  id: string;
  orgnr: string | null;
  name: string | null;
  org_form: string | null;
  status_text: string | null;
  address: string | null;
  industry_code: string | null;
  registered_at: Date | string | null;
  raw_brreg_json?: any;
}

export interface BrregFieldSuggestion {
  field: string;
  current: string | null;
  suggested: string | null;
  confidence: number;
  reasoning: string;
}

export interface BrregSuggestionData {
  diff: BrregFieldSuggestion[];
  etag: string | null;
  runId: string;
}

const FIELD_CONFIG: Array<{ field: keyof OrganizationRow | 'registered_at'; reasonKey: string }> = [
  { field: 'name', reasonKey: 'Navn fra BRREG avviker' },
  { field: 'org_form', reasonKey: 'Organisasjonsform oppdatert i BRREG' },
  { field: 'status_text', reasonKey: 'Status endret i BRREG' },
  { field: 'address', reasonKey: 'Adresse i BRREG er annerledes' },
  { field: 'industry_code', reasonKey: 'NACE-kode fra BRREG avviker' },
  { field: 'registered_at', reasonKey: 'Registreringsdato oppdatert' },
];

function normalizeDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function compareOrg(brreg: BrregOrgDetails, org: OrganizationRow): BrregFieldSuggestion[] {
  const suggestions: BrregFieldSuggestion[] = [];

  FIELD_CONFIG.forEach((cfg) => {
    const orgValueRaw = cfg.field === 'registered_at' ? normalizeDate(org.registered_at) : (org as any)[cfg.field];
    const brregValueRaw = cfg.field === 'registered_at' ? normalizeDate(brreg.registered_at ?? null) : (brreg as any)[cfg.field];

    const orgValue = orgValueRaw === undefined ? null : (orgValueRaw ?? null);
    const brValue = brregValueRaw === undefined ? null : (brregValueRaw ?? null);

    if ((orgValue ?? '') === (brValue ?? '')) return;
    if (!brValue) return; // Skip suggestions where BRREG lacks value

    let confidence = 0.9;
    if (cfg.field === 'status_text') confidence = 0.95;
    if (cfg.field === 'address') confidence = 0.88;
    if (cfg.field === 'registered_at') confidence = 0.92;

    const reasoning = brreg.raw_json?.oppdateringsdato
      ? `${cfg.reasonKey}. Sist oppdatert ${brreg.raw_json.oppdateringsdato}.`
      : cfg.reasonKey;

    suggestions.push({
      field: String(cfg.field),
      current: orgValue,
      suggested: brValue,
      confidence,
      reasoning,
    });
  });

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

export async function generateBrregSuggestions(
  client: PoolClient,
  params: {
    org: OrganizationRow;
    brreg: BrregOrgDetails;
    orgId: string;
    createdBy: string | null;
  }
): Promise<BrregSuggestionData> {
  const { org, brreg, orgId, createdBy } = params;
  const inputHash = hashInput({ orgId, brreg, current: org });

  const { runId, result } = await executeAiRun(client, {
    orgId,
    feature: 'BRREG_SUGGEST',
    createdBy,
    inputHash,
    modelVersion: 'diff-heuristic-v1'
  }, async () => {
    const diff = compareOrg(brreg, org);
    return { data: { diff }, tokensIn: 0, tokensOut: 0, modelVersion: 'diff-heuristic-v1' };
  });

  const diff = result.diff;
  if (!diff.length) {
    return { diff, etag: null, runId };
  }

  const averageConfidence = diff.reduce((sum, item) => sum + item.confidence, 0) / diff.length;
  const etag = `brr-${randomUUID()}`;

  await client.query(
    `insert into public.ai_suggestions (
       org_id, feature, run_id, target_table, target_id, diff_json, confidence, reasoning, etag, created_by
     ) values ($1, $2, $3, 'organizations', $4, $5::jsonb, $6, $7, $8, $9)
     on conflict (org_id, feature, etag)
     do update set diff_json = excluded.diff_json,
                   confidence = excluded.confidence,
                   reasoning = excluded.reasoning,
                   run_id = excluded.run_id,
                   applied_by = null,
                   applied_at = null
     returning id`,
    [
      orgId,
      'BRREG_SUGGEST',
      runId,
      org.id,
      JSON.stringify({ diff }),
      averageConfidence,
      `Forslag generert mot BRREG for ${diff.length} felt`,
      etag,
      createdBy,
    ]
  );

  return { diff, etag, runId };
}
