import { test, expect } from '@playwright/test';

test('profile returns org + user with bypass', async ({ request }) => {
  const res = await request.get('/api/profile?orgId=__dev__', {
    headers: {
      'x-test-clerk-user-id': 'user_a',
      'x-test-clerk-email': 'a@example.com',
    },
  });
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.me?.primary_email).toBe('a@example.com');
});

test('profile requires auth if no bypass or Clerk', async ({ request }) => {
  const res = await request.get('/api/profile');
  expect([401, 403]).toContain(res.status());
});


