/**
 * E2E: переключение ролей и бизнеса.
 *
 * Покрывает базовые сценарии из docs/ROLE_SWITCHING_TEST_SCENARIOS.md:
 * - экран `/select-cabinet` для аккаунта с несколькими кабинетами и запоминание выбора;
 * - переключатель RoleAndBusinessSwitcher в шапке.
 *
 * Аккаунт E2E_TEST_MULTI_ROLE_EMAIL фикстуры — менеджер бизнеса, сотрудник (карточка «E2E Мульти»)
 * и клиент.
 */

import { test, expect, type Page } from './fixtures';

import { signInWithEmailSeed } from './authHelpers';
import { readRequiredEnv, skipIfMissingE2EEnv } from './testEnv';

skipIfMissingE2EEnv('role-switching.spec.ts', ['E2E_TEST_MULTI_ROLE_EMAIL']);

async function signInMultiRoleUser(page: Page) {
    await signInWithEmailSeed(page, readRequiredEnv('E2E_TEST_MULTI_ROLE_EMAIL'));
}

function switcher(page: Page) {
    return page.locator('header button[aria-haspopup="menu"]').first();
}

test.describe('Переключение ролей и бизнеса', () => {
    test('экран выбора кабинета предлагает все кабинеты и запоминает выбор', async ({ page }) => {
        await signInMultiRoleUser(page);

        await test.step('/select-cabinet показывает кабинеты аккаунта', async () => {
            await page.goto('/select-cabinet');
            await expect(page.getByRole('heading', { name: /как вы хотите зайти/i })).toBeVisible();

            const main = page.locator('main');
            await expect(main.getByRole('button', { name: 'Кабинет бизнеса' })).toBeVisible();
            await expect(main.getByRole('button', { name: 'Кабинет сотрудника' })).toBeVisible();
            await expect(main.getByRole('button', { name: 'Мои записи' })).toBeVisible();
        });

        await test.step('Выбор «Мои записи» ведёт в /cabinet и запоминается', async () => {
            await page.getByRole('checkbox').check();
            await page.locator('main').getByRole('button', { name: 'Мои записи' }).click();
            await expect(page).toHaveURL(/\/cabinet/, { timeout: 30_000 });

            const cookies = await page.context().cookies();
            expect(cookies.some((cookie) => /cabinet/i.test(cookie.name) && cookie.value.includes('cabinet'))).toBe(true);
        });
    });

    test('переключатель в шапке позволяет переходить между кабинетами', async ({ page }) => {
        await signInMultiRoleUser(page);
        await page.goto('/cabinet');

        await test.step('В меню перечислены кабинеты аккаунта', async () => {
            await expect(switcher(page)).toBeVisible();
            await switcher(page).click();
            const menu = page.getByRole('menu');
            await expect(menu.getByRole('menuitem', { name: 'Кабинет бизнеса' })).toBeVisible();
            await expect(menu.getByRole('menuitem', { name: 'Кабинет сотрудника' })).toBeVisible();
            await expect(menu.getByRole('menuitem', { name: 'Мои записи' })).toHaveAttribute('aria-current', 'page');
        });

        await test.step('Переход в кабинет бизнеса', async () => {
            await page.getByRole('menu').getByRole('menuitem', { name: 'Кабинет бизнеса' }).click();
            await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
            await expect(page.getByText('E2E Салон').first()).toBeVisible();
        });

        await test.step('Переход в кабинет сотрудника', async () => {
            await switcher(page).click();
            await page.getByRole('menu').getByRole('menuitem', { name: 'Кабинет сотрудника' }).click();
            await expect(page).toHaveURL(/\/staff/, { timeout: 30_000 });
            await expect(page.getByText('E2E Мульти').first()).toBeVisible();
        });
    });
});
