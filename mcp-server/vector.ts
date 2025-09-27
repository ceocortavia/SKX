import { ensureVectorConfig } from './env';

export interface VectorRecord {
  id: string;
  vector: number[];
  metadata?: Record<string, unknown>;
}

export interface VectorQueryResult {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

function getConfig() {
  return ensureVectorConfig();
}

function buildUrl(path: string): string {
  const cfg = getConfig();
  const base = cfg.url.replace(/\/+$/, '');
  const trimmedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}/indexes/${cfg.index}${trimmedPath}`;
}

async function vectorRequest<T>(path: string, body: unknown): Promise<T> {
  const cfg = getConfig();
  const res = await fetch(buildUrl(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upstash Vector error (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function upsertVectors(vectors: VectorRecord[]): Promise<void> {
  if (!vectors.length) return;
  await vectorRequest('/vectors', { vectors });
}

export async function queryVectors(vector: number[], topK: number, filter?: Record<string, unknown>): Promise<VectorQueryResult[]> {
  const body: Record<string, unknown> = {
    topK,
    vector,
    includeVectors: false,
  };
  if (filter) {
    body.filter = filter;
  }
  const response = await vectorRequest<{ result: VectorQueryResult[] }>('/query', body);
  return response.result ?? [];
}
