import { test, expect } from '@playwright/test';

test('health rls returns policy list and anon RLS=0', async ({ request }) => {
  const res = await request.get('/api/_health/rls');
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
  expect(json.anonRls?.users).toBe(0);
  expect(json.anonRls?.organizations).toBe(0);
  expect(Array.isArray(json.policies)).toBe(true);
  expect(json.policies.length).toBeGreaterThan(0);
});


