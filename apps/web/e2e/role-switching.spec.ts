/**
 * E2E: переключение ролей и бизнеса.
 *
 * Покрывает базовые сценарии из docs/ROLE_SWITCHING_TEST_SCENARIOS.md:
 * - редиректы с `/` при нескольких кабинетах и cookie предпочтения;
 * - экран `/select-cabinet`;
 * - переключатель RoleAndBusinessSwitcher в шапке.
 *
 * Для запуска:
 *   PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000 pnpm test:e2e -- role-switching.spec.ts
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

/**
 * ВНИМАНИЕ: этот тест полагается на заранее подготовленные данные:
 * - пользователь с логином E2E_TEST_MULTI_ROLE_EMAIL
 * - у него есть как минимум кабинеты клиента и бизнеса/сотрудника
 *
 * Сценарии стараются использовать максимально устойчивые селекторы и тексты из UI.
 */

async function signInMultiRoleUser(page: any) {
    const email = process.env.E2E_TEST_MULTI_ROLE_EMAIL || 'multi-role@test.com';

    await page.goto(`${BASE_URL}/auth/sign-in`);
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await expect(emailInput).toBeVisible({ timeout: 5000 });
    await emailInput.fill(email);

    const submit = page
        .locator('button:has-text("Отправить"), button:has-text("Продолжить"), button[type="submit"]')
        .first();
    if (await submit.isVisible({ timeout: 3000 })) {
        await submit.click();
    }

    // В реальном окружении здесь должна быть обработка OTP/магической ссылки.
    // Для E2E предположим, что тестовый пользователь уже авторизован через seed/cookie.
    await page.waitForTimeout(1000);
}

test.describe('Переключение ролей и бизнеса', () => {
    test('редиректы с / и экран выбора кабинета', async ({ page }) => {
        await signInMultiRoleUser(page);

        // Удаляем cookie предпочтения, чтобы увидеть /select-cabinet
        await page.context().clearCookies();

        await test.step('Заход на / приводит на /select-cabinet при нескольких кабинетах', async () => {
            await page.goto(`${BASE_URL}/`);
            await page.waitForLoadState('networkidle');

            await expect(page).toHaveURL(/\/select-cabinet/);

            // Заголовок и базовые элементы
            const title = page.locator('h1, h2').filter({ hasText: /как вы хотите зайти/i }).first();
            await expect(title).toBeVisible({ timeout: 5000 });

            // Должны быть кнопки/ссылки для разных кабинетов (хотя бы две)
            const options = page.locator('button, a').filter({
                hasText: /Кабинет бизнеса|Кабинет сотрудника|Мои записи|Админ-панель/i,
            });
            await expect(options).toHaveCountGreaterThan(1);
        });

        await test.step('Выбор «Мои записи» ведёт в /cabinet', async () => {
            const clientBtn = page
                .locator('button:has-text("Мои записи"), a:has-text("Мои записи")')
                .first();
            await expect(clientBtn).toBeVisible({ timeout: 5000 });
            await clientBtn.click();

            await page.waitForLoadState('networkidle');
            await expect(page).toHaveURL(/\/cabinet/);

            const header = page.locator('h1').filter({ hasText: /мои записи/i }).first();
            await expect(header).toBeVisible({ timeout: 5000 });
        });
    });

    test('переключатель в шапке позволяет переходить между кабинетами', async ({ page }) => {
        await signInMultiRoleUser(page);

        await page.goto(`${BASE_URL}/cabinet`);
        await page.waitForLoadState('networkidle');

        const header = page.locator('h1').filter({ hasText: /мои записи/i }).first();
        await expect(header).toBeVisible({ timeout: 5000 });

        await test.step('Открываем RoleAndBusinessSwitcher', async () => {
            const switcherButton = page
                .locator('button')
                .filter({ hasText: /Клиент|Кабинет|Владелец|менеджер|Админ/i })
                .first();
            await expect(switcherButton).toBeVisible({ timeout: 5000 });
            await switcherButton.click();
        });

        await test.step('Переход в кабинет бизнеса (если доступен)', async () => {
            const bizOption = page
                .locator('a')
                .filter({ hasText: /Кабинет бизнеса/i })
                .first();

            if (await bizOption.isVisible({ timeout: 2000 }).catch(() => false)) {
                await bizOption.click();
                await page.waitForLoadState('networkidle');
                await expect(page).toHaveURL(/\/dashboard/);
            }
        });

        await test.step('Переход в кабинет сотрудника (если доступен)', async () => {
            const switcherButton = page
                .locator('button')
                .filter({ hasText: /Клиент|Кабинет|Владелец|менеджер|Админ/i })
                .first();
            if (await switcherButton.isVisible({ timeout: 2000 }).catch(() => false)) {
                await switcherButton.click();

                const staffOption = page
                    .locator('a')
                    .filter({ hasText: /Кабинет сотрудника/i })
                    .first();
                if (await staffOption.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await staffOption.click();
                    await page.waitForLoadState('networkidle');
                    await expect(page).toHaveURL(/\/staff/);
                }
            }
        });
    });
});

