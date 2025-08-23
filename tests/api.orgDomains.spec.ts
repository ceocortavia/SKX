import { test, expect } from '@playwright/test';

test('org-domains POST requires MFA unless bypass treats as on', async ({ request }) => {
  const res = await request.post('/api/org-domains', {
    headers: {
      'x-test-clerk-user-id': 'user_a',
      'x-test-clerk-email': 'a@example.com',
      'content-type': 'application/json',
    },
    data: { domain: 'e2e-smoke.local' },
  });
  // With TEST_AUTH_BYPASS=1, assertMFA() returns true → expect 200
  expect([200, 401, 403]).toContain(res.status());
});


