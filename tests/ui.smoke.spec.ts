import { test, expect } from '@playwright/test';

test('landing renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Velkommen til SKX' })).toBeVisible();
});

test('dashboard renders with bypass', async ({ page }) => {
  await page.goto('/dashboard', {
    headers: {
      'x-test-clerk-user-id': 'user_a',
      'x-test-clerk-email': 'a@example.com',
    } as any,
  });
  await expect(page.getByText('Dashboard')).toBeVisible();
});

test('admin renders tabs (data may be empty)', async ({ page }) => {
  await page.goto('/admin', {
    headers: {
      'x-test-clerk-user-id': 'user_a',
      'x-test-clerk-email': 'a@example.com',
    } as any,
  });
  await expect(page.getByText('Domains')).toBeVisible();
  await expect(page.getByText('Invitations')).toBeVisible();
  await expect(page.getByText('Audit')).toBeVisible();
});


