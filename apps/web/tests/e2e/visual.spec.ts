import { expect, test } from '@playwright/test';

test('login screen visual baseline', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'مرحبًا بعودتك' })).toBeVisible();
  await expect(page).toHaveScreenshot('login.png', { fullPage: true });
});
