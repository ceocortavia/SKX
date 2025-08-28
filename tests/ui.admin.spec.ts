import { test, expect } from '@playwright/test';

test('admin renders for authed user and shows tabs', async ({ page }) => {
  await page.goto('/admin', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: /admin/i })).toBeVisible();
  await expect(page.getByRole('tab', { name: /org/i })).toBeVisible();
  await expect(page.getByRole('tab', { name: /domener/i })).toBeVisible();
  await expect(page.getByRole('tab', { name: /medlemmer/i })).toBeVisible();
  await expect(page.getByRole('tab', { name: /invitasjoner/i })).toBeVisible();
  await expect(page.getByRole('tab', { name: /audit/i })).toBeVisible();
  await expect(page.getByTestId('org-switcher')).toBeVisible();
  await page.getByRole('tab', { name: /domener/i }).click();
  await expect(page.getByText(/domene|domain/i)).toBeVisible();
});

test('admin shows MFA hint on actions', async ({ page }) => {
  await page.goto('/admin');
  const btn = page.getByRole('button', { name: /legg til domene/i });
  await expect(btn).toBeVisible();
  await expect(btn).toBeDisabled();
  await expect(page.getByText(/mfa kreves/i)).toBeVisible();
});





