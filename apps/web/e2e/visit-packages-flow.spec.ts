/**
 * E2E: Пакеты визитов — полный сценарий
 * Владелец создаёт план → продаёт пакет клиенту в QuickDesk → записывает его → отмечает посещение
 * → в «Проданные пакеты» остаток уменьшился; в кабинете клиента визит «По пакету визитов».
 *
 * Фикстура (scripts/e2e-seed.mjs): клиент E2E_TEST_CLIENT_EMAIL и его вчерашний визит
 * «E2E Клиент пакет» (confirmed), который можно отметить.
 *
 * Запуск: pnpm test:e2e e2e/visit-packages-flow.spec.ts
 */

import { test, expect, type StorageState } from './fixtures';

import { applyStorageStateCookies, createStorageStateForEmailSeed, signInWithEmailSeed } from './authHelpers';
import { openBookingsTab } from './flows';
import { readRequiredEnv, skipIfMissingE2EEnv } from './testEnv';

skipIfMissingE2EEnv('visit-packages-flow.spec.ts', [
    'E2E_TEST_MANAGER_EMAIL',
    'E2E_TEST_CLIENT_SEARCH',
    'E2E_TEST_CLIENT_EMAIL',
]);

// The cabinet check reads the visit the first test pays with the package.
test.describe.configure({ mode: 'serial' });

test.describe('Пакеты визитов: план → продажа → бронь → посещение → остаток', () => {
    let managerStorageState: StorageState | null = null;
    const planName = `E2E Пакет ${Date.now()}`;

    test.beforeAll(async ({ browser }) => {
        managerStorageState = await createStorageStateForEmailSeed(browser, readRequiredEnv('E2E_TEST_MANAGER_EMAIL'));
    });

    test('полный сценарий: создание плана, продажа пакета, бронь, отметка посещения, проверка остатка', async ({ page }) => {
        await applyStorageStateCookies(page, managerStorageState);
        const clientSearch = readRequiredEnv('E2E_TEST_CLIENT_SEARCH');

        await test.step('1. Создать тип пакета', async () => {
            await page.goto('/dashboard/visit-packages');
            await page.locator('a[href="/dashboard/visit-packages/new"]').first().click();
            await page.waitForURL(/\/dashboard\/visit-packages\/new/, { timeout: 30_000 });

            const form = page.getByTestId('visit-package-plan-form');
            await expect(form).toBeVisible();

            await page.getByLabel(/Название \(русский\)/i).fill(planName);
            await page.getByLabel(/Количество визитов/i).fill('5');
            await page.getByLabel(/Срок действия \(дней\)/i).fill('90');
            await page.getByRole('radio', { name: /Процент/ }).check();
            await page.getByLabel(/Значение скидки/i).fill('20');

            await page.getByTestId('visit-package-plan-submit').click();
            await page.waitForURL(/\/dashboard\/visit-packages(?:\?|$)/, { timeout: 30_000 });
            await expect(page.getByText(planName).first()).toBeVisible();
        });

        await test.step('2. Продать пакет клиенту в QuickDesk', async () => {
            await openBookingsTab(page, 'Сегодня (QuickDesk)');
            await page.getByRole('button', { name: /Существующий/ }).click();
            await page.getByPlaceholder(/Поиск: \+996/).fill(clientSearch);
            await page.getByRole('button', { name: /E2E Клиент/ }).click();

            await page.getByRole('button', { name: 'Продать пакет' }).click();
            const modal = page.getByRole('dialog');
            await expect(modal).toBeVisible();
            const plan = await modal.locator('option', { hasText: planName }).getAttribute('value');
            await modal.locator('select').selectOption(plan ?? '');
            const sale = page.waitForResponse(
                (r) => r.url().includes('/visit-packages') && r.request().method() === 'POST',
            );
            await modal.getByRole('button', { name: 'Продать пакет' }).click();
            const response = await sale;
            expect(response.status()).toBe(200);
            expect(await response.json()).toMatchObject({ ok: true });
            await expect(modal).toBeHidden();
        });

        await test.step('3. Создать бронирование для выбранного клиента', async () => {
            await page.getByLabel('Филиал', { exact: true }).selectOption({ label: 'E2E Филиал Центр' });
            await page.getByRole('button', { name: 'Завтра', exact: true }).click();
            await page.getByLabel('Мастер', { exact: true }).selectOption({ label: 'E2E Мастер' });
            await page.getByLabel('Услуга', { exact: true }).selectOption({ label: 'Стрижка · 30 мин' });
            const time = page.getByLabel('Время', { exact: true });
            await expect(time).toBeEnabled({ timeout: 15_000 });
            await time.selectOption({ index: 1 });

            await page.getByRole('button', { name: 'Создать запись' }).click();
            await expect(page.getByText(/Создана запись #[0-9a-f]{8}/)).toBeVisible();
        });

        await test.step('4. Отметить посещение (пришёл) визита клиента', async () => {
            await openBookingsTab(page, 'История и поиск');
            await page.getByLabel('Поиск', { exact: true }).fill('E2E Клиент пакет');
            const row = page.locator('tr', { hasText: 'E2E Клиент пакет' });
            await expect(row).toHaveCount(1);
            await row.getByRole('button', { name: 'Пришёл', exact: true }).click();
            await page.getByRole('dialog').getByRole('button', { name: 'Подтвердить', exact: true }).click();
            await expect(row).toContainText('пришёл');
        });

        await test.step('5. Проверить остаток по пакету в «Проданные пакеты»', async () => {
            await page.goto('/dashboard/visit-packages');
            await page.getByRole('button', { name: /Проданные пакеты/ }).click();

            const table = page.getByTestId('sold-packages-table');
            await expect(table).toBeVisible();

            const row = page.getByTestId('sold-package-row').filter({ hasText: planName }).first();
            await expect(row).toBeVisible();
            await expect(row).toHaveAttribute('data-remaining', '4');
        });
    });

    test('в кабинете клиента отображается «По пакету визитов»', async ({ page }) => {
        await signInWithEmailSeed(page, readRequiredEnv('E2E_TEST_CLIENT_EMAIL'));
        await page.goto('/cabinet');
        // Yesterday's visit is in the history tab.
        const history = page.getByRole('tab', { name: 'История' });
        await expect(async () => {
            await history.click();
            await expect(history).toHaveAttribute('aria-selected', 'true', { timeout: 2_000 });
        }).toPass({ timeout: 20_000 });

        await expect(page.getByText(/По пакету визитов/).first()).toBeVisible({ timeout: 20_000 });
    });
});
