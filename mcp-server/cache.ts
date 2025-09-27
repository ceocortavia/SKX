import { redisConfig, redisTtlSeconds } from './env';

const config = redisConfig();

interface RedisResponse<T> {
  result: T;
  error?: string;
}

async function redisRequest<T>(body: unknown): Promise<T | null> {
  if (!config) return null;
  const res = await fetch(config.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upstash Redis error (${res.status}): ${text}`);
  }
  const data = (await res.json()) as RedisResponse<T>;
  return data.result ?? null;
}

export async function redisGet<T>(key: string): Promise<T | null> {
  const res = await redisRequest<string | null>(['GET', key]);
  if (!res) return null;
  try {
    return JSON.parse(res) as T;
  } catch {
    return null;
  }
}

export async function redisSet<T>(key: string, value: T, ttlSeconds: number = redisTtlSeconds): Promise<void> {
  if (!config) return;
  const payload: (string | number)[] = ['SET', key, JSON.stringify(value)];
  if (ttlSeconds > 0) {
    payload.push('EX', ttlSeconds.toString());
  }
  await redisRequest(payload);
}

