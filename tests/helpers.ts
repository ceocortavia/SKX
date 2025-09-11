import { APIResponse, APIRequestContext, expect } from '@playwright/test';

export const defaultHeaders: Record<string, string> = {
  'content-type': 'application/json',
  'x-test-clerk-user-id': process.env.NEXT_PUBLIC_DEV_BYPASS_USER_ID || 'user_a',
  'x-test-clerk-email': process.env.NEXT_PUBLIC_DEV_BYPASS_EMAIL || 'a@example.com',
  'x-test-mfa': 'on',
};

export async function postJson(
  req: APIRequestContext,
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return req.post(url, {
    data: JSON.stringify(body),
    headers: { ...defaultHeaders, ...headers },
  });
}

export async function fetchJson(
  req: APIRequestContext,
  url: string,
  headers: Record<string, string> = {},
) {
  const res = await req.get(url, { headers: { ...defaultHeaders, ...headers } });
  const json = await safeJson(res);
  return { res, json } as const;
}

type SeedInvitationsResult = { orgId: string; invitationIds: string[] };

export async function seedInvitationsAPI(
  req: APIRequestContext,
  { orgId, count = 3 }: { orgId: string; count?: number }
): Promise<SeedInvitationsResult> {
  const create = await req.post('/api/test/seed/invitations', {
    headers: { ...defaultHeaders, 'x-test-org-id': orgId, 'x-test-run-id': process.env.TEST_RUN_ID || 'local' },
    data: { count },
  });
  expect(create.status(), 'seed invitations status').toBe(200);
  const createdJson = await create.json();
  expect(createdJson?.ok).toBe(true);
  expect(createdJson?.orgId).toBe(orgId);
  const ids: string[] = (createdJson?.invitations || [])
    .filter((i: any) => i?.status === 'pending' && typeof i?.id === 'string')
    .map((i: any) => i.id);
  expect(ids.length, 'antall pending invitationIds').toBe(count);
  return { orgId, invitationIds: ids };
}

export async function expectOk(res: APIResponse) {
  const status = res.status();
  const statusText = res.statusText();
  expect([200, 202]).toContain(status);
  expect(['OK', 'Accepted']).toContain(statusText);
  const json = await safeJson(res);
  expect((json as any)?.ok).toBe(true);
  return json;
}

export async function expectInvalidJson(res: APIResponse) {
  const status = res.status();
  const json = await safeJson(res);
  expect(
    status,
    `status code mismatch\nstatus=${status}\nbody=${JSON.stringify(json)}`
  ).toBe(400);
  if (json && typeof json === 'object' && 'ok' in json) expect((json as any).ok).toBe(false);
  expect((json as any)?.error).toBe('invalid_json');
}

export async function expectInvalidInput(res: APIResponse, reason: string) {
  expect(res.status(), 'status code').toBe(400);
  const json = await safeJson(res);
  if ('ok' in json) expect(json.ok).toBe(false);
  expect(json?.error).toBe('invalid_input');
  expect(json?.reason).toBe(reason);
}

async function safeJson(res: APIResponse) {
  try {
    return await res.json();
  } catch {
    try {
      const txt = await res.text();
      return { _nonJsonText: txt } as any;
    } catch {
      return null as any;
    }
  }
}

export const makeIds = (n: number, prefix = 'id_') =>
  Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);
