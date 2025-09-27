import type { PoolClient } from 'pg';

export type AiFeature = 'BRREG_SUGGEST' | 'INVITE_COPY' | 'CSV_MAP' | 'COPILOT_QA';

export interface ExecuteAiRunOptions {
  orgId: string;
  feature: AiFeature;
  createdBy?: string | null;
  inputHash?: string | null;
  modelVersion?: string | null;
}

export interface ExecuteAiRunResult<T> {
  data: T;
  tokensIn?: number;
  tokensOut?: number;
  modelVersion?: string | null;
}

const DEFAULT_MODEL_VERSION = 'fallback-local';

function truncateError(err: unknown): string {
  if (!err) return '';
  const msg = typeof err === 'string' ? err : (err as any)?.message ?? String(err);
  return msg.slice(0, 2000);
}

export async function executeAiRun<T>(
  client: PoolClient,
  options: ExecuteAiRunOptions,
  task: () => Promise<ExecuteAiRunResult<T>>
): Promise<{ runId: string; result: T; tokensIn: number; tokensOut: number; modelVersion: string; latencyMs: number }>
{
  const { orgId, feature, createdBy = null, inputHash = null, modelVersion = null } = options;

  const inserted = await client.query<{ id: string }>(
    `insert into public.ai_runs (org_id, feature, status, created_by, input_hash, model_version)
     values ($1, $2, 'QUEUED', $3, $4, $5)
     returning id`,
    [orgId, feature, createdBy, inputHash, modelVersion]
  );
  const runId = inserted.rows[0].id;

  const started = Date.now();

  // Mark as running for observability
  await client.query(`update public.ai_runs set status = 'RUNNING' where id = $1`, [runId]);

  try {
    const { data, tokensIn = 0, tokensOut = 0, modelVersion: resolvedModel } = await task();
    const latency = Date.now() - started;
    const finalModel = resolvedModel ?? modelVersion ?? DEFAULT_MODEL_VERSION;

    await client.query(
      `update public.ai_runs
         set status = 'SUCCESS',
             latency_ms = $2,
             tokens_in = $3,
             tokens_out = $4,
             model_version = $5,
             error_text = null
       where id = $1`,
      [runId, latency, tokensIn, tokensOut, finalModel]
    );

    return { runId, result: data, tokensIn, tokensOut, modelVersion: finalModel, latencyMs: latency };
  } catch (err) {
    const latency = Date.now() - started;
    await client.query(
      `update public.ai_runs set status = 'ERROR', latency_ms = $2, error_text = $3 where id = $1`,
      [runId, latency, truncateError(err)]
    );
    throw err;
  }
}

