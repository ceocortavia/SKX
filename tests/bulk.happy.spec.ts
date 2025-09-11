import { test, expect } from '@playwright/test';
import { postJson, expectOk, seedInvitationsAPI, defaultHeaders } from './helpers';

async function seedInvitations(request: any, count: number) {
  const res = await request.post('/api/test/seed', {
    headers: {
      'content-type': 'application/json',
      'x-test-secret': process.env.TEST_SEED_SECRET || 'secret',
      'x-test-clerk-user-id': 'user_a',
      'x-test-clerk-email': 'a@example.com',
    },
    data: { invitations: count },
  });
  const ct = res.headers()['content-type'] || '';
  if (!ct.includes('application/json')) {
    console.log('Seed response non-JSON', res.status(), await res.text());
    expect(ct.includes('application/json')).toBeTruthy();
  }
  expect(res.status()).toBe(200);
  return res.json();
}

async function cleanup(request: any) {
  await request.post('/api/test/cleanup', {
    headers: {
      'content-type': 'application/json',
      'x-test-secret': process.env.TEST_SEED_SECRET || 'secret',
      'x-test-clerk-user-id': 'user_a',
      'x-test-clerk-email': 'a@example.com',
    },
    data: {},
  });
}

test.describe('Bulk APIs — happy path', () => {
  test('invitations/bulk-revoke: pending -> revoked (seeded)', async ({ request }) => {
    const orgId = process.env.NEXT_PUBLIC_TEST_ORG_ID || '9f217b9c-40ce-4814-a77b-5ef3cd5e9697';
    const seed = await seedInvitationsAPI(request, { orgId, count: 2 });
    const res = await postJson(request, '/api/invitations/bulk-revoke', {
      invitationIds: seed.invitationIds,
    }, { ...defaultHeaders, 'x-test-org-id': seed.orgId });
    await expectOk(res);
  });
});


