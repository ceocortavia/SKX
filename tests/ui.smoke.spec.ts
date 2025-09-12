import { test, expect } from '@playwright/test';

test.describe('UI smoke', () => {
  test('header visible, hero rendered, accordion toggles', async ({ page }) => {
    await page.goto('/');

    const header = page.locator('header[role="navigation"]');
    await expect(header).toBeVisible();

    // Hero heading
    const heroHeading = page.getByRole('heading', { level: 1 }).first();
    await expect(heroHeading).toBeVisible();

    // Accordion card (ServicesSection uses cards that expand on click)
    const firstCard = page.locator('#tjenester').getByText('AI Rekruttering', { exact: true });
    await expect(firstCard).toBeVisible();

    // Click to expand
    await firstCard.click();

    // Expect expanded content to appear
    await expect(page.locator('#tjenester').getByText('Detaljert beskrivelse')).toBeVisible();
  });
});



