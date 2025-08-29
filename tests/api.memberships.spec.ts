import { test, expect } from '@playwright/test';

test('memberships returns rows with bypass', async ({ request }) => {
  const res = await request.get('/api/memberships', {
    headers: { 
      'x-test-clerk-user-id': 'user_a', 
      'x-test-clerk-email': 'a@example.com', 
      'x-org-id': '9f217b9c-40ce-4814-a77b-5ef3cd5e9697' 
    }
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body.memberships)).toBe(true);
  expect(body.memberships.length).toBeGreaterThan(0);
});
