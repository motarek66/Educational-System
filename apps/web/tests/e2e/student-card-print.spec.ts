import { expect, test } from '@playwright/test';

test('opens student card printing from the student profile', async ({ page }) => {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are required for this test.');
  }

  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/login');
  await page.locator('#identifier').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).not.toHaveURL(/\/login$/);

  await page.goto('/students');
  const studentProfileLink = page.locator('a[href^="/students/"]:visible').first();
  await expect(studentProfileLink).toBeVisible();
  await studentProfileLink.click();

  const printButton = page.getByRole('button', { name: 'طباعة الكارت' });
  await expect(printButton).toBeVisible();
  const qrResponsePromise = page.waitForResponse((response) => /\/students\/[^/]+\/qr$/.test(response.url()));
  await printButton.click();

  const dialog = page.getByRole('dialog', { name: 'معاينة طباعة كارت الطالب' });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((element) => element.parentElement === document.body)).toBe(true);
  expect((await qrResponsePromise).status()).toBe(200);

  await expect(dialog.locator('iframe[title^="معاينة كارت"]')).toBeVisible({ timeout: 30_000 });

  const downloadButton = dialog.getByRole('button', { name: 'تحميل PDF' });
  await expect(downloadButton).toBeEnabled();
  const downloadPromise = page.waitForEvent('download');
  await downloadButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^student-card-.+\.pdf$/);

  const printButtonInDialog = dialog.getByRole('button', { name: 'طباعة', exact: true });
  await expect(printButtonInDialog).toBeEnabled();
  await printButtonInDialog.click();
  await expect(page.locator('body > iframe[aria-hidden="true"][src^="blob:"]')).toHaveCount(1);
  expect(pageErrors).toEqual([]);
});
