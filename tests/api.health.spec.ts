import { test, expect } from '@playwright/test';

test('health returns 200 with bypass', async ({ request }) => {
  const res = await request.get('/api/health/rls', {
    headers: { 'x-test-clerk-user-id': 'user_a', 'x-test-clerk-email': 'a@example.com' }
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toMatchObject({ status: 'healthy' });
});
