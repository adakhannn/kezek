/**
 * Visual regression coverage for high-value UI surfaces.
 *
 * Run:
 *   pnpm -C apps/web test:e2e -- visual-regressions.spec.ts
 */

import { expect, test, type Page, type StorageState } from '@playwright/test';

import { applyStorageStateCookies, createStorageStateForEmailSeed } from './authHelpers';
import { getBaseUrl, readRequiredEnv, skipIfMissingE2EEnv } from './testEnv';

const BASE_URL = getBaseUrl();

async function setDesktopViewport(page: Page): Promise<void> {
    await page.setViewportSize({ width: 1366, height: 900 });
}

async function setMobileViewport(page: Page): Promise<void> {
    await page.setViewportSize({ width: 390, height: 844 });
}

async function takeStablePageScreenshot(page: Page, name: string, maxDiffPixels = 350): Promise<void> {
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(900);
    await expect(page).toHaveScreenshot(name, {
        fullPage: true,
        animations: 'disabled',
        maxDiffPixels,
    });
}

async function selectBusinessIfPrompted(page: Page): Promise<void> {
    if (!/\/select-business/.test(page.url())) return;

    const firstBusinessButton = page.locator('main button').first();
    if (await firstBusinessButton.isVisible({ timeout: 4000 }).catch(() => false)) {
        await firstBusinessButton.click();
        await page.waitForLoadState('networkidle');
    }
}

async function pickCabinetRoleIfPrompted(page: Page): Promise<void> {
    if (!/\/select-cabinet/.test(page.url())) return;

    const myBookingsLink = page
        .locator('a[href="/cabinet"], button:has-text("Мои записи"), button:has-text("My bookings")')
        .first();
    if (await myBookingsLink.isVisible({ timeout: 4000 }).catch(() => false)) {
        await myBookingsLink.click();
        await page.waitForLoadState('networkidle');
    }
}

async function resolveWorkspacePrompts(page: Page): Promise<void> {
    await selectBusinessIfPrompted(page);
    await pickCabinetRoleIfPrompted(page);
}

skipIfMissingE2EEnv('visual-regressions.spec.ts (public)', ['E2E_TEST_BUSINESS_SLUG']);

test.describe('Visual regressions: public pages', () => {
    test('business page remains visually stable', async ({ page }) => {
        const businessSlug = readRequiredEnv('E2E_TEST_BUSINESS_SLUG');
        await setDesktopViewport(page);
        await page.goto(`${BASE_URL}/b/${businessSlug}`, { waitUntil: 'networkidle' });
        await takeStablePageScreenshot(page, 'public-business-page.png');
    });

    test('booking step page remains visually stable', async ({ page }) => {
        const businessSlug = readRequiredEnv('E2E_TEST_BUSINESS_SLUG');
        await setDesktopViewport(page);
        await page.goto(`${BASE_URL}/b/${businessSlug}`, { waitUntil: 'networkidle' });

        const branchSelector = page.locator('[data-testid="branch-select"]').first();
        if (await branchSelector.isVisible({ timeout: 4000 }).catch(() => false)) {
            await branchSelector.click();
            await page.locator('[data-testid="branch-option"]').first().click();
        }

        const staffSelector = page.locator('[data-testid="master-select"]').first();
        if (await staffSelector.isVisible({ timeout: 4000 }).catch(() => false)) {
            await staffSelector.click();
            await page.locator('[data-testid="master-option"]').first().click();
        }

        const serviceSelector = page.locator('[data-testid="service-select"]').first();
        if (await serviceSelector.isVisible({ timeout: 4000 }).catch(() => false)) {
            await serviceSelector.click();
            await page.locator('[data-testid="service-option"]').first().click();
        }

        const datePicker = page.locator('[data-testid="date-picker"]').first();
        if (await datePicker.isVisible({ timeout: 4000 }).catch(() => false)) {
            await datePicker.click();
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const yyyy = tomorrow.getFullYear();
            const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
            const dd = String(tomorrow.getDate()).padStart(2, '0');
            await page.locator(`[data-date="${yyyy}-${mm}-${dd}"]`).first().click();
        }

        await page.waitForSelector('[data-testid="time-slot"]', { timeout: 10000 });
        await page.locator('[data-testid="time-slot"]').first().scrollIntoViewIfNeeded();
        await takeStablePageScreenshot(page, 'public-booking-step-time.png');
    });
});

test.describe('Visual regressions: workspace pages', () => {
    skipIfMissingE2EEnv('visual-regressions.spec.ts (workspace)', ['E2E_TEST_MANAGER_EMAIL', 'E2E_TEST_STAFF_ID']);

    let managerAuthState: StorageState | null = null;

    test.beforeAll(async ({ browser }) => {
        const managerEmail = readRequiredEnv('E2E_TEST_MANAGER_EMAIL');
        managerAuthState = await createStorageStateForEmailSeed(browser, managerEmail);
    });

    test.beforeEach(async ({ page }) => {
        await setDesktopViewport(page);
        await applyStorageStateCookies(page, managerAuthState);
    });

    test('cabinet bookings page stays stable', async ({ page }) => {
        await page.goto(`${BASE_URL}/cabinet`, { waitUntil: 'networkidle' });
        await resolveWorkspacePrompts(page);
        await takeStablePageScreenshot(page, 'workspace-cabinet-bookings.png');
    });

    test('dashboard home command center stays stable', async ({ page }) => {
        await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
        await resolveWorkspacePrompts(page);
        await takeStablePageScreenshot(page, 'workspace-dashboard-home.png');
    });

    test('dashboard bookings quickdesk stays stable', async ({ page }) => {
        await page.goto(`${BASE_URL}/dashboard/bookings`, { waitUntil: 'networkidle' });
        await resolveWorkspacePrompts(page);

        const quickDeskTab = page
            .locator('button:has-text("QuickDesk"), button:has-text("Стол"), [data-testid="desk-tab"]')
            .first();
        if (await quickDeskTab.isVisible({ timeout: 5000 }).catch(() => false)) {
            await quickDeskTab.click();
            await page.waitForTimeout(700);
        }

        await takeStablePageScreenshot(page, 'workspace-dashboard-bookings-quickdesk.png', 450);
    });

    test('dashboard bookings list tab stays stable', async ({ page }) => {
        await page.goto(`${BASE_URL}/dashboard/bookings`, { waitUntil: 'networkidle' });
        await resolveWorkspacePrompts(page);

        const listTab = page
            .locator('button:has-text("Список"), button:has-text("List"), [data-testid="bookings-list-tab"]')
            .first();
        if (await listTab.isVisible({ timeout: 5000 }).catch(() => false)) {
            await listTab.click();
            await page.waitForTimeout(700);
        }

        await takeStablePageScreenshot(page, 'workspace-dashboard-bookings-list.png', 450);
    });

    test('staff detail page stays stable', async ({ page }) => {
        const staffId = readRequiredEnv('E2E_TEST_STAFF_ID');
        await page.goto(`${BASE_URL}/dashboard/staff/${staffId}`, { waitUntil: 'networkidle' });
        await resolveWorkspacePrompts(page);
        await takeStablePageScreenshot(page, 'workspace-staff-detail.png', 450);
    });

    test('staff finance page stays stable', async ({ page }) => {
        const staffId = readRequiredEnv('E2E_TEST_STAFF_ID');
        await page.goto(`${BASE_URL}/dashboard/staff/${staffId}/finance`, { waitUntil: 'networkidle' });
        await resolveWorkspacePrompts(page);
        await takeStablePageScreenshot(page, 'workspace-staff-finance.png', 500);
    });

    test('staff finance stats page stays stable', async ({ page }) => {
        const staffId = readRequiredEnv('E2E_TEST_STAFF_ID');
        await page.goto(`${BASE_URL}/dashboard/staff/${staffId}/finance/stats`, { waitUntil: 'networkidle' });
        await resolveWorkspacePrompts(page);
        await takeStablePageScreenshot(page, 'workspace-staff-finance-stats.png', 500);
    });

    test('mobile quickdesk stays stable', async ({ page }) => {
        await setMobileViewport(page);
        await page.goto(`${BASE_URL}/dashboard/bookings`, { waitUntil: 'networkidle' });
        await resolveWorkspacePrompts(page);

        const quickDeskTab = page
            .locator('button:has-text("QuickDesk"), button:has-text("Стол"), [data-testid="desk-tab"]')
            .first();
        if (await quickDeskTab.isVisible({ timeout: 5000 }).catch(() => false)) {
            await quickDeskTab.click();
            await page.waitForTimeout(700);
        }

        await takeStablePageScreenshot(page, 'workspace-mobile-quickdesk.png', 500);
    });
});

test.describe('Visual regressions: staff cabinet pages', () => {
    skipIfMissingE2EEnv('visual-regressions.spec.ts (staff cabinet)', ['E2E_TEST_STAFF_EMAIL']);

    let staffAuthState: StorageState | null = null;

    test.beforeAll(async ({ browser }) => {
        const staffEmail = readRequiredEnv('E2E_TEST_STAFF_EMAIL');
        staffAuthState = await createStorageStateForEmailSeed(browser, staffEmail);
    });

    test.beforeEach(async ({ page }) => {
        await setDesktopViewport(page);
        await applyStorageStateCookies(page, staffAuthState);
    });

    test('staff finance cabinet stays stable', async ({ page }) => {
        await page.goto(`${BASE_URL}/staff/finance`, { waitUntil: 'networkidle' });
        await resolveWorkspacePrompts(page);
        await takeStablePageScreenshot(page, 'workspace-staff-cabinet-finance.png', 500);
    });
});
