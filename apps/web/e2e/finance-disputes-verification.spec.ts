/**
 * E2E тест: Сценарии споров — суммы, которые видит сотрудник, совпадают с записанными в смене.
 *
 * Сценарии:
 * - сотрудник добавляет клиентов и закрывает смену; итог в UI равен итогам закрытой смены в БД
 *   (статистика менеджера /api/dashboard/staff/[id]/finance/stats), доли не превышают оборот;
 * - корректировка hours_worked менеджером сохраняется и пересчитывает guaranteed_amount.
 */

import { test, expect, type Page, type StorageState } from './fixtures';

import { applyStorageStateCookies, createStorageStateForEmailSeed } from './authHelpers';
import { addShiftClient, businessDate, ensureShiftOpen, openStaffShiftOfDay, shiftSummaryAmount } from './flows';
import { readRequiredEnv, skipIfMissingE2EEnv } from './testEnv';

skipIfMissingE2EEnv('finance-disputes-verification.spec.ts', ['E2E_TEST_MANAGER_EMAIL', 'E2E_TEST_STAFF_EMAIL', 'E2E_TEST_STAFF_ID']);

type StatsShift = {
    id: string;
    shift_date: string;
    status: string;
    total_amount: number;
    consumables_amount: number;
    master_share: number;
    salon_share: number;
    hours_worked: number | null;
    guaranteed_amount: number;
};

async function shiftOfDay(page: Page, staffId: string, ymd: string): Promise<StatsShift> {
    const response = await page.request.get(`/api/dashboard/staff/${staffId}/finance/stats?period=day&date=${ymd}`);
    expect(response.status()).toBe(200);
    const json = await response.json();
    const body = json.data ?? json;
    const stats = body.stats ?? body;
    const shift = (stats.shifts as StatsShift[]).find((row) => row.shift_date === ymd);
    expect(shift, `shift of ${ymd}`).toBeTruthy();
    return shift as StatsShift;
}

test.describe('Проверка совпадения сумм между UI и записанной сменой', () => {
    let managerAuthState: StorageState | null = null;
    let staffAuthState: StorageState | null = null;

    test.beforeAll(async ({ browser }) => {
        managerAuthState = await createStorageStateForEmailSeed(browser, readRequiredEnv('E2E_TEST_MANAGER_EMAIL'));
        staffAuthState = await createStorageStateForEmailSeed(browser, readRequiredEnv('E2E_TEST_STAFF_EMAIL'));
    });

    test('должен проверить совпадение сумм после закрытия смены', async ({ page }) => {
        const staffId = readRequiredEnv('E2E_TEST_STAFF_ID');
        await applyStorageStateCookies(page, staffAuthState);

        await test.step('Открытие смены и добавление клиентов', async () => {
            await page.goto('/staff/finance');
            await ensureShiftOpen(page);
            await addShiftClient(page, { name: 'Клиент для проверки логов 1', service: 'Стрижка', amount: 1500 });
            await addShiftClient(page, { name: 'Клиент для проверки логов 2', service: 'Окрашивание', amount: 2000 });
        });

        let uiToStaff = 0;
        let uiToBusiness = 0;
        await test.step('Закрытие смены и суммы в UI', async () => {
            await page.getByRole('button', { name: /^Текущая смена/ }).first().click();
            await page.getByRole('button', { name: 'Закрыть смену' }).click();
            // The staff page shows the closed status; reopening is the manager's action.
            await expect(page.getByText('Закрыта', { exact: true })).toBeVisible({ timeout: 20_000 });
            await expect(page.getByRole('button', { name: 'Закрыть смену' })).toHaveCount(0);

            uiToStaff = await shiftSummaryAmount(page, 'Итого сотруднику за смену');
            uiToBusiness = await shiftSummaryAmount(page, 'Итого бизнесу за смену');
            expect(uiToStaff).toBeGreaterThan(0);
            expect(uiToBusiness).toBeGreaterThan(0);
        });

        await test.step('Суммы закрытой смены в БД совпадают с UI', async () => {
            await page.context().clearCookies();
            await applyStorageStateCookies(page, managerAuthState);
            const shift = await shiftOfDay(page, staffId, businessDate(0));

            expect(shift.status).toBe('closed');
            expect(shift.total_amount).toBeGreaterThanOrEqual(3500);
            expect(shift.master_share).toBeCloseTo(uiToStaff, 2);
            expect(shift.salon_share).toBeCloseTo(uiToBusiness, 2);
            expect(shift.master_share + shift.salon_share).toBeLessThanOrEqual(
                shift.total_amount + shift.consumables_amount + shift.guaranteed_amount,
            );
        });
    });

    test('должен проверить историю изменений при корректировке hours_worked', async ({ page }) => {
        const staffId = readRequiredEnv('E2E_TEST_STAFF_ID');
        await applyStorageStateCookies(page, managerAuthState);
        const yesterday = businessDate(-1);

        const before = await shiftOfDay(page, staffId, yesterday);
        const next = before.hours_worked === 9.5 ? 9 : 9.5;

        const card = await openStaffShiftOfDay(page, staffId, yesterday);
        await card.getByRole('button').first().click();
        await card.getByRole('button', { name: 'Исправить часы' }).click();
        await card.getByLabel('Введите фактическое количество отработанных часов').fill(String(next));
        const update = page.waitForResponse((response) => response.url().includes('/update-hours'));
        await card.getByRole('button', { name: 'Сохранить' }).click();
        expect((await update).status()).toBe(200);

        const after = await shiftOfDay(page, staffId, yesterday);
        expect(after.hours_worked).toBe(next);
        // 100 сом/ч in the fixture; the shares of the turnover stay as they were.
        expect(after.guaranteed_amount).toBe(next * 100);
        expect(after.total_amount).toBe(before.total_amount);
        expect(after.master_share).toBe(before.master_share);
        expect(after.salon_share).toBe(before.salon_share);
    });
});
