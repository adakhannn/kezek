/**
 * E2E: создание и редактирование филиала в админке.
 *
 * Сценарий (суперадмин):
 * - открыть страницу создания филиала для бизнеса E2E_TEST_BUSINESS_ID;
 * - заполнить название и адрес, сохранить;
 * - найти филиал в списке, открыть редактирование и убедиться, что данные и блок координат на месте.
 *
 * Выбор точки на карте (BranchMapPickerYandex) требует ключа и сети Яндекс.Карт, поэтому в
 * локальном стеке он не проверяется (test.fixme ниже); запросы к Яндексу блокируются.
 */

import { test, expect } from './fixtures';

import { signInWithEmailSeed } from './authHelpers';
import { readRequiredEnv, skipIfMissingE2EEnv } from './testEnv';

skipIfMissingE2EEnv('branch-map.spec.ts', ['E2E_TEST_SUPERADMIN_EMAIL', 'E2E_TEST_BUSINESS_ID']);

test.describe('Админка: филиал с картой', () => {
    test.beforeEach(async ({ page }) => {
        await page.route(/yandex\.(ru|net)|yastatic\.net/, (route) => route.abort());
        await signInWithEmailSeed(page, readRequiredEnv('E2E_TEST_SUPERADMIN_EMAIL'));
    });

    test('создание и редактирование филиала', async ({ page }) => {
        const bizId = readRequiredEnv('E2E_TEST_BUSINESS_ID');
        const name = `E2E филиал ${Date.now()}`;

        await test.step('Открыть страницу создания филиала', async () => {
            await page.goto(`/admin/businesses/${bizId}/branches/new`);
            await expect(page.getByRole('heading', { name: 'Новый филиал' })).toBeVisible();
        });

        await test.step('Заполнить название и адрес', async () => {
            await page.locator('input[name="branch_name"]').fill(name);
            await expect(page.getByText(/Координаты:/)).toBeVisible();
            await page.locator('input[name="branch_address"]').fill('Бишкек, пр. Чуй, 100');
        });

        await test.step('Сохранить филиал и перейти к списку', async () => {
            const submit = page.getByRole('button', { name: 'Создать филиал' });
            await expect(submit).toBeEnabled();
            await submit.click();
            await expect(page).toHaveURL(new RegExp(`/admin/businesses/${bizId}/branches$`), { timeout: 30_000 });
            await expect(page.getByRole('heading', { name: /Филиалы/ }).first()).toBeVisible();
        });

        await test.step('Найти созданный филиал в списке и открыть редактирование', async () => {
            const edit = page.getByRole('link', { name: 'Редактировать' });
            const card = page.locator('div', { hasText: name }).filter({ has: edit }).last();
            await card.getByRole('link', { name: 'Редактировать' }).click();
            await expect(page).toHaveURL(new RegExp(`/admin/businesses/${bizId}/branches/[0-9a-f-]{36}`), { timeout: 30_000 });
            await expect(page.getByRole('heading', { name: 'Редактировать филиал' })).toBeVisible();

            await expect(page.locator('input[name="branch_name"]')).toHaveValue(name);
            await expect(page.locator('input[name="branch_address"]')).toHaveValue('Бишкек, пр. Чуй, 100');
            await expect(page.getByText(/Координаты:/)).toBeVisible();
        });
    });

    // Needs the Yandex Maps JS API (key and network), which the local stack does not have.
    test.fixme('клик по карте задаёт координаты и адрес филиала', async () => {});
});
