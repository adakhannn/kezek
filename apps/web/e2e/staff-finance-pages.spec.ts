/**
 * E2E тест: Страницы финансов сотрудника
 * Тестирует:
 * - /staff/finance (кабинет сотрудника E2E_TEST_STAFF_EMAIL)
 * - /dashboard/staff/[id]/finance и /finance/stats (страницы менеджера/владельца)
 */

import { test, expect, type StorageState } from './fixtures';

import { applyStorageStateCookies, createStorageStateForEmailSeed } from './authHelpers';
import { addShiftClient, businessDate, ensureShiftOpen, openStaffShiftOfDay, shiftSummaryAmount } from './flows';
import { readRequiredEnv, skipIfMissingE2EEnv } from './testEnv';

skipIfMissingE2EEnv('staff-finance-pages.spec.ts', ['E2E_TEST_MANAGER_EMAIL', 'E2E_TEST_STAFF_EMAIL', 'E2E_TEST_STAFF_ID']);

test.describe('Страницы финансов сотрудника', () => {
    let managerAuthState: StorageState | null = null;
    let staffAuthState: StorageState | null = null;

    test.beforeAll(async ({ browser }) => {
        managerAuthState = await createStorageStateForEmailSeed(browser, readRequiredEnv('E2E_TEST_MANAGER_EMAIL'));
        staffAuthState = await createStorageStateForEmailSeed(browser, readRequiredEnv('E2E_TEST_STAFF_EMAIL'));
    });

    test.describe('Страница сотрудника /staff/finance', () => {
        test.beforeEach(async ({ page }) => {
            await applyStorageStateCookies(page, staffAuthState);
        });

        test('должна загружаться без ошибок', async ({ page }) => {
            const response = await page.goto('/staff/finance');
            expect(response?.status()).toBe(200);

            await expect(page.getByRole('heading', { name: 'Финансы' }).first()).toBeVisible();
            await expect(page.getByRole('button', { name: /^Текущая смена/ }).first()).toBeVisible();
            await expect(page.getByRole('button', { name: /^Клиенты/ }).first()).toBeVisible();
            await expect(page.getByRole('button', { name: /^Статистика/ }).first()).toBeVisible();
            await expect(page.getByText('Ошибка загрузки данных')).toHaveCount(0);
        });

        test('должна отображать данные смены при открытой смене', async ({ page }) => {
            await page.goto('/staff/finance');
            await ensureShiftOpen(page);

            const today = businessDate(0).split('-').reverse().join('.');
            await expect(page.getByText(new RegExp(`${today.replace(/\./g, '\\.')} \\(Asia/Bishkek\\)`))).toBeVisible();
            await expect(page.getByText('Открыта').first()).toBeVisible();
            await expect(page.getByText('Сводка по смене')).toBeVisible();
        });

        test('должна обрабатывать ошибки сети корректно', async ({ page }) => {
            let failing = true;
            await page.route('**/api/staff/finance**', async (route) => {
                if (failing) await route.abort('failed');
                else await route.continue();
            });

            await page.goto('/staff/finance');
            await expect(page.getByText('Ошибка загрузки данных')).toBeVisible({ timeout: 30_000 });

            failing = false;
            await page.getByRole('button', { name: 'Попробовать снова' }).click();
            await expect(page.getByText('Ошибка загрузки данных')).toHaveCount(0, { timeout: 20_000 });
            await expect(page.getByText('Сводка по смене')).toBeVisible();
        });
    });

    test.describe('Страница менеджера /dashboard/staff/[id]/finance', () => {
        test.beforeEach(async ({ page }) => {
            await applyStorageStateCookies(page, managerAuthState);
        });

        test('должна загружаться для менеджера', async ({ page }) => {
            const staffId = readRequiredEnv('E2E_TEST_STAFF_ID');
            const response = await page.goto(`/dashboard/staff/${staffId}/finance`);
            expect(response?.status()).toBe(200);

            await expect(page.getByRole('heading', { name: /E2E Мастер/ }).first()).toBeVisible();
            await expect(page.getByRole('button', { name: /^Текущая смена/ }).first()).toBeVisible();
            await expect(page.getByText('Ошибка загрузки данных')).toHaveCount(0);
        });

        test('должна показывать понятное сообщение, если сотрудник не из бизнеса', async ({ page }) => {
            // The not-found page keeps the load event pending under `next dev`; the content is what counts.
            await page.goto('/dashboard/staff/00000000-0000-4000-8000-000000000000/finance', { waitUntil: 'commit' });

            await expect(page.getByText('Сотрудник не найден')).toBeVisible();
            await expect(page.getByRole('link', { name: /Вернуться к списку сотрудников/ })).toBeVisible();
        });

        test('владелец: открыть смену сотруднику и добавить клиента', async ({ page }) => {
            const staffId = readRequiredEnv('E2E_TEST_STAFF_ID');
            await page.goto(`/dashboard/staff/${staffId}/finance`);
            await ensureShiftOpen(page);
            await addShiftClient(page, { name: 'E2E Owner Client', service: 'Стрижка', amount: 1000 });
        });
    });

    test.describe('Общие проверки', () => {
        test.beforeEach(async ({ page }) => {
            await applyStorageStateCookies(page, staffAuthState);
        });

        test('частая смена вкладок не перегружает API и не ломает страницу', async ({ page }) => {
            const statuses: number[] = [];
            page.on('response', (response) => {
                if (response.url().includes('/api/staff/finance')) statuses.push(response.status());
            });
            await page.goto('/staff/finance');
            await expect(page.getByText('Сводка по смене').or(page.getByText('Смена не открыта')).first()).toBeVisible();

            for (let i = 0; i < 5; i += 1) {
                await page.getByRole('button', { name: /^Клиенты/ }).first().click();
                await page.getByRole('button', { name: /^Текущая смена/ }).first().click();
            }

            await expect(page.getByText('Ошибка загрузки данных')).toHaveCount(0);
            expect(statuses.length).toBeGreaterThan(0);
            expect(statuses.every((status) => status === 200)).toBe(true);
        });

        test('должна корректно обрабатывать валидацию клиентских данных', async ({ page }) => {
            await page.goto('/staff/finance');
            await ensureShiftOpen(page);
            await page.getByRole('button', { name: /^Клиенты/ }).first().click();
            await page.getByRole('button', { name: 'Добавить клиента' }).first().click();

            const form = page
                .locator('div')
                .filter({ has: page.getByRole('heading', { name: 'Редактирование клиента' }) })
                .filter({ has: page.getByPlaceholder('Введите имя клиента') })
                .last();
            await form.getByPlaceholder('Введите имя клиента').fill('E2E Валидация');
            await form.locator('input[type="number"]').first().fill('-100');
            await form.locator('input[type="number"]').first().blur();

            // Invalid input is reported in the form and cannot be saved.
            await expect(form.getByText(/Сумма услуги должна быть неотрицательным числом/).first()).toBeVisible();
            await expect(form.getByRole('button', { name: 'Сохранить', exact: true })).toBeDisabled();
        });
    });

    test.describe('Критические сценарии работы с финансами', () => {
        test.beforeEach(async ({ page }) => {
            await applyStorageStateCookies(page, staffAuthState);
        });

        test('должен открыть смену, добавить клиентов и закрыть смену', async ({ page }) => {
            await page.goto('/staff/finance');
            await ensureShiftOpen(page);
            await addShiftClient(page, { name: 'Тестовый Клиент', service: 'Стрижка', amount: 1000 });

            await page.getByRole('button', { name: /^Текущая смена/ }).first().click();
            await page.getByRole('button', { name: 'Закрыть смену' }).click();
            // The staff page shows the closed status; reopening is the manager's action.
            await expect(page.getByText('Закрыта', { exact: true })).toBeVisible({ timeout: 20_000 });
            await expect(page.getByRole('button', { name: 'Закрыть смену' })).toHaveCount(0);
        });

        test('должен экспортировать данные в CSV', async ({ page }) => {
            await page.goto('/staff/finance');
            await ensureShiftOpen(page);
            await addShiftClient(page, { name: 'E2E Экспорт', service: 'Укладка', amount: 700 });

            const download = page.waitForEvent('download');
            await page.getByRole('button', { name: /Экспорт/ }).first().click();
            expect((await download).suggestedFilename()).toMatch(/\.csv$/);
        });

        test('должен корректно отображать финансовую сводку', async ({ page }) => {
            await page.goto('/staff/finance');
            await ensureShiftOpen(page);

            await expect(page.getByText('Сводка по смене')).toBeVisible();
            await expect(page.getByText('Итого сотруднику за смену')).toBeVisible();
            await expect(page.getByText('Итого бизнесу за смену')).toBeVisible();
        });

        test('должен корректно отображать часы и доход по смене', async ({ page }) => {
            await page.goto('/staff/finance');
            await ensureShiftOpen(page);
            await addShiftClient(page, { name: 'Клиент для теста дохода', service: 'Окрашивание', amount: 2500 });

            await page.getByRole('button', { name: /^Текущая смена/ }).first().click();
            const toStaff = await shiftSummaryAmount(page, 'Итого сотруднику за смену');
            const toBusiness = await shiftSummaryAmount(page, 'Итого бизнесу за смену');
            // 60/40 split of at least the 2500 just added; the guarantee (100 сом/ч) is shown next to it.
            expect(toStaff + toBusiness).toBeGreaterThanOrEqual(2500);
            expect(toBusiness).toBeGreaterThan(0);
            await expect(page.getByText(/Оплата за выход: \d+\.\d{2} сом/)).toBeVisible();
        });

        test('должен корректно фильтровать данные по периодам в статистике', async ({ page }) => {
            await page.goto('/staff/finance');
            await page.getByRole('button', { name: /^Статистика/ }).first().click();
            await expect(page.getByText('Общая статистика по сменам')).toBeVisible();

            // The fixture's closed shift of yesterday (3500 сом) is always within "all time".
            await page.getByRole('button', { name: 'Все время', exact: true }).click();
            await expect(page.getByText(/Всего закрытых смен: [1-9]\d*/)).toBeVisible();
            const revenue = page.getByText('Общая выручка', { exact: true }).locator('xpath=following-sibling::div[1]');
            await expect(revenue).toContainText(/\d+ сом/);
            expect(Number((await revenue.textContent())?.replace(/[^\d]/g, ''))).toBeGreaterThanOrEqual(3500);

            for (const period of ['День', 'Месяц', 'Год']) {
                await page.getByRole('button', { name: period, exact: true }).click();
                await expect(revenue).toContainText(/\d+ сом/);
            }
            await expect(page.getByText('Ошибка статистики')).toHaveCount(0);
        });
    });

    test.describe('Страница статистики сотрудника /dashboard/staff/[id]/finance/stats', () => {
        test.beforeEach(async ({ page }) => {
            await applyStorageStateCookies(page, managerAuthState);
        });

        test('владелец: выбор периода, обновление, исправление часов закрытой смены', async ({ page }) => {
            const staffId = readRequiredEnv('E2E_TEST_STAFF_ID');
            await page.goto(`/dashboard/staff/${staffId}/finance/stats`);

            await page.getByRole('button', { name: 'Месяц', exact: true }).click();
            const refreshed = page.waitForResponse((r) => r.url().includes(`/api/dashboard/staff/${staffId}/finance/stats`));
            await page.getByRole('button', { name: 'Обновить' }).click();
            expect((await refreshed).status()).toBe(200);

            const card = await openStaffShiftOfDay(page, staffId, businessDate(-1));
            await card.getByRole('button').first().click();
            await card.getByRole('button', { name: 'Исправить часы' }).click();
            await card.getByLabel('Введите фактическое количество отработанных часов').fill('8.25');

            const update = page.waitForResponse((r) => r.url().includes('/api/dashboard/staff-shifts/') && r.url().includes('/update-hours'));
            await card.getByRole('button', { name: 'Сохранить' }).click();
            expect((await update).status()).toBe(200);
        });
    });
});
