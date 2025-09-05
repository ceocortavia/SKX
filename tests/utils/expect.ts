import { expect, APIResponse } from '@playwright/test';

export async function expectInvalidJson(res: APIResponse) {
  expect(res.status()).toBe(400);
  const j = await res.json();
  if ('ok' in j) expect(j.ok).toBe(false);
  expect(j?.error).toBe('invalid_json');
}

export async function expectInvalidInput(res: APIResponse, reason?: string) {
  expect(res.status()).toBe(400);
  const j = await res.json();
  if ('ok' in j) expect(j.ok).toBe(false);
  expect(j?.error).toBe('invalid_input');
  if (reason) expect(j?.reason).toBe(reason);
}

export async function expectUnauthorized(res: APIResponse) {
  const s = res.status();
  expect([401, 307]).toContain(s);
}

export function makeMany(n: number, seed = 'id_') {
  return Array.from({ length: n }, (_, i) => `${seed}${i + 1}`);
}



