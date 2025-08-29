import { test, expect } from '@playwright/test';

test('org-domains POST works with MFA bypass', async ({ request }) => {
  const res = await request.post('/api/org-domains', {
    headers: {
      'x-test-clerk-user-id': 'user_a',
      'x-test-clerk-email': 'a@example.com',
      'x-org-id': '9f217b9c-40ce-4814-a77b-5ef3cd5e9697'
    },
    data: { domain: `smoke-${Date.now()}.example` }
  });
  expect([200, 409]).toContain(res.status()); // 409 hvis unikt domene kolliderer
});
