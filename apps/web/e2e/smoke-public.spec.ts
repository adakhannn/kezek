import { expect, test } from '@playwright/test';

test.describe('Public smoke pages', () => {
    test('sign-in page renders the primary auth form', async ({ page }) => {
        await page.goto('/auth/sign-in');

        await expect(page).toHaveURL(/\/auth\/sign-in$/);
        await expect(page.locator('h1').first()).toBeVisible();
        await expect(page.locator('input[type="email"]').first()).toBeVisible();
        await expect(page.locator('button[type="submit"]').first()).toBeVisible();
    });

    test('terms page renders core legal content', async ({ page }) => {
        await page.goto('/terms');

        await expect(page).toHaveURL(/\/terms$/);
        await expect(page.locator('h1').first()).toBeVisible();
        await expect(page.locator('section').first()).toBeVisible();
        await expect(page.locator('a[href="/"]').first()).toBeVisible();
    });

    test('privacy page renders core privacy content', async ({ page }) => {
        await page.goto('/privacy');

        await expect(page).toHaveURL(/\/privacy$/);
        await expect(page.locator('h1').first()).toBeVisible();
        await expect(page.locator('section').first()).toBeVisible();
        await expect(page.locator('a[href="/"]').first()).toBeVisible();
    });
});
