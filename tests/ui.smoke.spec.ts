import { test, expect } from '@playwright/test';

test('landing renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Velkommen til SKX' })).toBeVisible();
});

test('dashboard renders with bypass', async ({ page }) => {
  // Set test headers before navigation
  await page.setExtraHTTPHeaders({
    'x-test-clerk-user-id': 'user_a',
    'x-test-clerk-email': 'a@example.com',
  });
  await page.goto('/dashboard');
  await expect(page.getByText('Dashboard')).toBeVisible();
});

test('admin renders tabs (data may be empty)', async ({ page }) => {
  // Set test headers before navigation
  await page.setExtraHTTPHeaders({
    'x-test-clerk-user-id': 'user_a',
    'x-test-clerk-email': 'a@example.com',
  });
  await page.goto('/admin');
  await expect(page.getByText('Domains')).toBeVisible();
  await expect(page.getByText('Invitations')).toBeVisible();
  await expect(page.getByText('Audit')).toBeVisible();
});


