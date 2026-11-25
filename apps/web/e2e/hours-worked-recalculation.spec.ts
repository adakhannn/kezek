/**
 * E2E тест: Корректировка hours_worked и проверка перерасчёта гарантий/долей
 *
 * Сценарии (страница менеджера /dashboard/staff/[id]/finance/stats):
 * - обновление hours_worked для закрытой смены и перерасчёт guaranteed_amount (часы × ставка);
 * - доли master_share / salon_share не меняются, доплата не появляется, пока гарантия меньше доли;
 * - валидация: отрицательное и больше суток значение не сохраняется;
 * - открытая смена не предлагает исправить часы.
 *
 * Фикстура (scripts/e2e-seed.mjs): вчерашняя закрытая смена E2E_TEST_STAFF_ID — оборот 3500,
 * сотруднику 2100, бизнесу 1400, 9 ч, ставка 100 сом/ч.
 */

import { test, expect, type StorageState } from './fixtures';

import { applyStorageStateCookies, createStorageStateForEmailSeed } from './authHelpers';
import { businessDate, ensureShiftOpen, openStaffShiftOfDay } from './flows';
import { readRequiredEnv, skipIfMissingE2EEnv } from './testEnv';

skipIfMissingE2EEnv('hours-worked-recalculation.spec.ts', ['E2E_TEST_MANAGER_EMAIL', 'E2E_TEST_STAFF_ID']);

const HOURLY_RATE = 100;

test.describe('Корректировка hours_worked и перерасчёт гарантий/долей', () => {
    let managerAuthState: StorageState | null = null;

    test.beforeAll(async ({ browser }) => {
        managerAuthState = await createStorageStateForEmailSeed(browser, readRequiredEnv('E2E_TEST_MANAGER_EMAIL'));
    });

    test.beforeEach(async ({ page }) => {
        await applyStorageStateCookies(page, managerAuthState);
    });

    test('должен обновить hours_worked и пересчитать guaranteed_amount', async ({ page }) => {
        const staffId = readRequiredEnv('E2E_TEST_STAFF_ID');
        const card = await openStaffShiftOfDay(page, staffId, businessDate(-1));
        await expect(card).toContainText('Закрыта');
        await card.getByRole('button').first().click();

        const hoursValue = card.getByText('ч', { exact: true }).locator('xpath=following-sibling::p[1]');
        const current = Number(await hoursValue.textContent());
        const next = current === 8.5 ? 7.5 : 8.5;

        await card.getByRole('button', { name: 'Исправить часы' }).click();
        await card.getByLabel('Введите фактическое количество отработанных часов').fill(String(next));
        const update = page.waitForResponse((response) => response.url().includes('/update-hours'));
        await card.getByRole('button', { name: 'Сохранить' }).click();

        const response = await update;
        expect(response.status()).toBe(200);
        expect(await response.json()).toHaveProperty('ok', true);

        const refreshed = await openStaffShiftOfDay(page, staffId, businessDate(-1));
        await refreshed.getByRole('button').first().click();
        await expect(refreshed.getByText('ч', { exact: true }).locator('xpath=following-sibling::p[1]')).toHaveText(next.toFixed(2));
        // Guarantee = hours × hourly rate; it stays below the 60% share, so the shares do not change.
        const guarantee = refreshed.getByText('Гарантия', { exact: true }).locator('xpath=following-sibling::p[1]');
        await expect(guarantee).toContainText(String(next * HOURLY_RATE));
        await expect(refreshed).toContainText(/Сотруднику: 2[\s ]?100 сом/);
        await expect(refreshed).toContainText(/Бизнесу: 1[\s ]?400 сом/);
    });

    for (const [title, value] of [
        ['отрицательное значение', '-1'],
        ['слишком большое значение', '50'],
    ] as const) {
        test(`должен проверить валидацию hours_worked (${title})`, async ({ page }) => {
            const staffId = readRequiredEnv('E2E_TEST_STAFF_ID');
            const card = await openStaffShiftOfDay(page, staffId, businessDate(-1));
            await card.getByRole('button').first().click();
            await card.getByRole('button', { name: 'Исправить часы' }).click();
            await card.getByLabel('Введите фактическое количество отработанных часов').fill(value);

            let updateCalled = false;
            page.on('request', (request) => {
                if (request.url().includes('/update-hours')) updateCalled = true;
            });
            await card.getByRole('button', { name: 'Сохранить' }).click();

            await expect(card.getByText('Некорректное значение часов')).toBeVisible();
            expect(updateCalled).toBe(false);
        });
    }

    test('должен проверить, что нельзя изменить hours_worked для открытой смены', async ({ page }) => {
        const staffId = readRequiredEnv('E2E_TEST_STAFF_ID');
        await page.goto(`/dashboard/staff/${staffId}/finance`);
        await ensureShiftOpen(page);

        const card = await openStaffShiftOfDay(page, staffId, businessDate(0));
        // An open shift card is expanded and shows no hours editor.
        await expect(card).toContainText('Открыта');
        await expect(card.getByText('Гарантия', { exact: true })).toBeVisible();
        await expect(card.getByRole('button', { name: 'Исправить часы' })).toHaveCount(0);
    });
});
