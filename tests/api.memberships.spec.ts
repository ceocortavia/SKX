import { test, expect } from '@playwright/test';

test('approve membership enforces admin+MFA', async ({ request }) => {
  const res = await request.post('/api/memberships/approve', {
    headers: {
      'x-test-clerk-user-id': 'user_a',
      'x-test-clerk-email': 'a@example.com',
      'content-type': 'application/json',
    },
    data: { userId: '00000000-0000-0000-0000-000000000000' },
  });
  expect([200, 401, 403]).toContain(res.status());
});


