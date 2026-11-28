/**
 * Visual regression coverage for high-value UI surfaces.
 *
 * Baselines (visual-regressions.spec.ts-snapshots/*-chromium-linux.png) are rendered on Linux in
 * the official Playwright image against a freshly seeded local stack; see e2e/README.md. Dates and
 * times are masked and the Next.js dev overlay is hidden, so the pictures do not depend on the day.
 *
 * Run:
 *   pnpm -C apps/web test:e2e:visual
 */

import path from 'node:path';

import { expect, test, type Locator, type Page, type StorageState } from './fixtures';

import { applyStorageStateCookies, createStorageStateForEmailSeed } from './authHelpers';
import { businessDate, openBookingsTab, walkPublicBookingToSlots } from './flows';
import { readRequiredEnv, skipIfMissingE2EEnv } from './testEnv';

const STYLE_PATH = path.join(__dirname, 'visual-regressions.css');

async function setDesktopViewport(page: Page): Promise<void> {
    await page.setViewportSize({ width: 1366, height: 900 });
}

async function setMobileViewport(page: Page): Promise<void> {
    await page.setViewportSize({ width: 390, height: 844 });
}

/** Everything whose text follows the calendar or the clock. */
function dynamicContent(page: Page): Locator[] {
    return [
        page.getByTestId('date-picker'),
        page.locator('input[type="date"], input[type="month"]'),
        page.getByText(/\d{1,2}\.\d{2}\.\d{4}/),
        page.getByText(/\d{4}-\d{2}-\d{2}/),
        page.getByText(/понедельник|вторник|сред[аы]|четверг|пятниц[аы]|суббот[аы]|воскресенье/i),
        page.getByText(/\d{1,2} (января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/i),
        page.getByText(/(январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)[ья]? \d{4}/i),
        // Visit dates in the owner format «27 нояб. • 09:00–10:00» (@shared-client/visitFormat).
        page.getByText(/\d{1,2} (янв\.|февр\.|мар\.|апр\.|мая|июн\.|июл\.|авг\.|сент\.|окт\.|нояб\.|дек\.)/i),
    ];
}

async function takeStablePageScreenshot(page: Page, name: string): Promise<void> {
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    // No hover state and the sticky header at the top: the picture must not depend on the last action.
    await page.mouse.move(0, 0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page).toHaveScreenshot(name, {
        fullPage: true,
        animations: 'disabled',
        caret: 'hide',
        mask: dynamicContent(page),
        stylePath: STYLE_PATH,
        timeout: 20_000,
    });
}

skipIfMissingE2EEnv('visual-regressions.spec.ts', [
    'E2E_TEST_BUSINESS_SLUG',
    'E2E_TEST_MANAGER_EMAIL',
    'E2E_TEST_STAFF_ID',
    'E2E_TEST_STAFF_EMAIL',
]);

test.describe('Visual regressions: public pages', () => {
    test('business page remains visually stable', async ({ page }) => {
        await setDesktopViewport(page);
        await page.goto(`/b/${readRequiredEnv('E2E_TEST_BUSINESS_SLUG')}`);
        await expect(page.getByTestId('promotions-section')).toBeVisible();
        await takeStablePageScreenshot(page, 'public-business-page.png');
    });

    test('booking step page remains visually stable', async ({ page }) => {
        await setDesktopViewport(page);
        const slot = await walkPublicBookingToSlots(page, {
            slug: readRequiredEnv('E2E_TEST_BUSINESS_SLUG'),
            day: businessDate(1),
        });
        await expect(slot).toBeVisible();
        await takeStablePageScreenshot(page, 'public-booking-step-time.png');
    });
});

test.describe('Visual regressions: workspace pages', () => {
    let managerAuthState: StorageState | null = null;

    test.beforeAll(async ({ browser }) => {
        managerAuthState = await createStorageStateForEmailSeed(browser, readRequiredEnv('E2E_TEST_MANAGER_EMAIL'));
    });

    test.beforeEach(async ({ page }) => {
        await setDesktopViewport(page);
        await applyStorageStateCookies(page, managerAuthState);
    });

    test('cabinet bookings page stays stable', async ({ page }) => {
        await page.goto('/cabinet');
        await expect(page.getByRole('heading').first()).toBeVisible();
        await takeStablePageScreenshot(page, 'workspace-cabinet-bookings.png');
    });

    test('dashboard home command center stays stable', async ({ page }) => {
        await page.goto('/dashboard');
        await expect(page.getByText('E2E Салон').first()).toBeVisible();
        await takeStablePageScreenshot(page, 'workspace-dashboard-home.png');
    });

    test('dashboard bookings quickdesk stays stable', async ({ page }) => {
        await openBookingsTab(page, 'Сегодня (QuickDesk)');
        await expect(page.getByRole('button', { name: 'Создать запись' })).toBeVisible();
        await takeStablePageScreenshot(page, 'workspace-dashboard-bookings-quickdesk.png');
    });

    test('dashboard bookings list tab stays stable', async ({ page }) => {
        await openBookingsTab(page, 'История и поиск');
        // The list shows the fixture's future bookings; the search keeps it independent of other runs.
        await page.getByLabel('Поиск', { exact: true }).fill('E2E Ожидает');
        await expect(page.locator('tr', { hasText: 'E2E Ожидает' })).toHaveCount(1);
        await takeStablePageScreenshot(page, 'workspace-dashboard-bookings-list.png');
    });

    test('staff detail page stays stable', async ({ page }) => {
        await page.goto(`/dashboard/staff/${readRequiredEnv('E2E_TEST_STAFF_ID')}`);
        await expect(page.getByText('E2E Мастер').first()).toBeVisible();
        await takeStablePageScreenshot(page, 'workspace-staff-detail.png');
    });

    test('staff finance page stays stable', async ({ page }) => {
        await page.goto(`/dashboard/staff/${readRequiredEnv('E2E_TEST_STAFF_ID')}/finance`);
        // The manager's copy opens on the clients of today's shift.
        await expect(page.getByText('Клиенты за смену')).toBeVisible();
        await takeStablePageScreenshot(page, 'workspace-staff-finance.png');
    });

    test('staff finance stats page stays stable', async ({ page }) => {
        const staffId = readRequiredEnv('E2E_TEST_STAFF_ID');
        await page.goto(`/dashboard/staff/${staffId}/finance/stats`);
        await page.getByRole('button', { name: 'День', exact: true }).click();
        const loaded = page.waitForResponse((r) => r.url().includes(`/api/dashboard/staff/${staffId}/finance/stats`));
        // Yesterday holds the fixture's closed shift, whatever the day of the month.
        await page.getByLabel('Дата периода').fill(businessDate(-1));
        await loaded;
        await expect(page.getByText('Закрыта').first()).toBeVisible();
        await takeStablePageScreenshot(page, 'workspace-staff-finance-stats.png');
    });

    test('mobile quickdesk stays stable', async ({ page }) => {
        await setMobileViewport(page);
        await openBookingsTab(page, 'Сегодня (QuickDesk)');
        await expect(page.getByRole('button', { name: 'Создать запись' })).toBeVisible();
        await takeStablePageScreenshot(page, 'workspace-mobile-quickdesk.png');
    });
});

test.describe('Visual regressions: staff cabinet pages', () => {
    let staffAuthState: StorageState | null = null;

    test.beforeAll(async ({ browser }) => {
        staffAuthState = await createStorageStateForEmailSeed(browser, readRequiredEnv('E2E_TEST_STAFF_EMAIL'));
    });

    test.beforeEach(async ({ page }) => {
        await setDesktopViewport(page);
        await applyStorageStateCookies(page, staffAuthState);
    });

    test('staff finance cabinet stays stable', async ({ page }) => {
        await page.goto('/staff/finance');
        await expect(page.getByText('Сводка по смене').or(page.getByText('Смена не открыта')).first()).toBeVisible();
        await takeStablePageScreenshot(page, 'workspace-staff-cabinet-finance.png');
    });
});
