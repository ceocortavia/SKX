import { test, expect } from '@playwright/test';

test('mobile menu toggles on hamburger click', async ({ page }) => {
  await page.goto('/');
  await page.setViewportSize({ width: 375, height: 812 });

  const button = page.getByRole('button', { name: /meny/i });
  await expect(button).toBeVisible();

  await button.click();
  await expect(page.locator('#mobile-menu')).toBeVisible();

  await button.click();
  await expect(page.locator('#mobile-menu')).toHaveCount(0);
});


