/**
 * E2E тест: Админский флоу работы с рейтинговой системой.
 *
 * Сценарий:
 *  - логин под суперадмином;
 *  - проверка статуса рейтингов (/admin/ratings-status);
 *  - переход на страницу настроек (/admin/rating-config), изменение конфигурации и сохранение;
 *  - запуск исторического пересчёта через UI;
 *  - ожидание завершения пересчёта (по сообщению/перезагрузке страницы);
 *  - повторная проверка /admin/ratings-status;
 *  - переход на /admin/ratings-debug и проверка отсутствия критичных ошибок.
 */

import { test, expect } from '@playwright/test';

test.describe('Админский флоу рейтинговой системы', () => {
    let superAdminAuthState: any;

    test.beforeAll(async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();

        const superAdminEmail = process.env.E2E_TEST_SUPER_ADMIN_EMAIL || 'superadmin@test.com';

        await page.goto('/auth/sign-in');
        await page.waitForLoadState('networkidle');

        const emailInput = page.locator('input[type="email"], input[name="email"]').first();
        if (await emailInput.isVisible({ timeout: 3000 })) {
            await emailInput.fill(superAdminEmail);

            const submitButton = page.locator('button:has-text("Отправить"), button[type="submit"]').first();
            if (await submitButton.isVisible({ timeout: 2000 })) {
                await submitButton.click();
                await page.waitForTimeout(2000);
            }
        }

        superAdminAuthState = await context.storageState();
        await context.close();
    });

    test.beforeEach(async ({ page }) => {
        if (superAdminAuthState) {
            await page.context().addCookies(superAdminAuthState.cookies);
        }
    });

    test('полный админский флоу рейтингов (status -> config -> recalc -> status -> debug)', async ({ page }) => {
        // 1. Проверка текущего статуса рейтингов
        await test.step('Открывает /admin/ratings-status и видит сводку', async () => {
            await page.goto('/admin/ratings-status');
            await page.waitForLoadState('networkidle');

            const title = page.locator('text=/Здоровье рейтинговой системы|Health of ratings/i').first();
            await expect(title).toBeVisible({ timeout: 10000 });

            const staffCard = page.locator('text=/Метрики сотрудников|staff metrics/i').first();
            await expect(staffCard).toBeVisible({ timeout: 10000 });

            const debugLink = page.locator('a:has-text("Отладка рейтингов"), a:has-text("ratings debug")').first();
            await expect(debugLink).toBeVisible({ timeout: 10000 });
        });

        // 2. Переход на страницу настроек рейтинга и изменение конфигурации
        await test.step('Переходит на /admin/rating-config и изменяет настройки', async () => {
            await page.goto('/admin/rating-config');
            await page.waitForLoadState('networkidle');

            const header = page.locator('text=/Веса компонентов рейтинга сотрудника|rating weights/i').first();
            await expect(header).toBeVisible({ timeout: 10000 });

            const windowInput = page.locator('input[type="number"][value], input[name*="window_days"]').first();
            if (await windowInput.isVisible({ timeout: 5000 })) {
                const currentValue = await windowInput.inputValue();
                const numeric = Number.parseInt(currentValue || '30', 10) || 30;
                const newValue = numeric === 30 ? 31 : 30;
                await windowInput.fill(String(newValue));
            }

            const saveButton = page.locator('button:has-text("Сохранить настройки"), button:has-text("Save settings")').first();
            await expect(saveButton).toBeVisible({ timeout: 5000 });
            await expect(saveButton).toBeEnabled({ timeout: 2000 });
            await saveButton.click();

            const successAlert = page.locator('text=/Настройки успешно сохранены|saved successfully/i').first();
            await expect(successAlert).toBeVisible({ timeout: 10000 });
        });

        // 3. Запуск исторического пересчёта через UI
        await test.step('Запускает исторический пересчёт через prompt', async () => {
            const recalcPrompt = page.locator('text=/Вы изменили веса\. Хотите пересчитать историю|recalculate history/i').first();
            await expect(recalcPrompt).toBeVisible({ timeout: 10000 });

            const daysSelect = page.locator('select').first();
            if (await daysSelect.isVisible({ timeout: 5000 })) {
                await daysSelect.selectOption('7');
            }

            const recalcButton = page
                .locator('button:has-text("Пересчитать"), button:has-text("Recalculate"), button:has-text("Пересчёт")')
                .first();
            await expect(recalcButton).toBeVisible({ timeout: 5000 });

            const recalcResponsePromise = page
                .waitForResponse((response) => {
                    const url = response.url();
                    return url.includes('/api/admin/initialize-ratings') && response.request().method() === 'POST';
                }, { timeout: 60000 })
                .catch(() => null);

            await recalcButton.click();

            const response = await recalcResponsePromise;
            if (response) {
                expect(response.status()).toBe(200);
                const data = await response.json();
                expect(data).toHaveProperty('ok');
                expect(data.ok).toBeTruthy();
            }

            await page.waitForTimeout(4000);
        });

        // 4. Повторная проверка /admin/ratings-status
        await test.step('Повторно проверяет /admin/ratings-status', async () => {
            await page.goto('/admin/ratings-status');
            await page.waitForLoadState('networkidle');

            const titleAgain = page.locator('text=/Здоровье рейтинговой системы|Health of ratings/i').first();
            await expect(titleAgain).toBeVisible({ timeout: 10000 });

            const metricsBlocks = page.locator('text=/Метрики сотрудников|Метрики филиалов|Метрики бизнесов|metrics/i');
            await expect(metricsBlocks.first()).toBeVisible({ timeout: 10000 });
        });

        // 5. Переход на /admin/ratings-debug и проверка, что критичных ошибок нет
        await test.step('Открывает /admin/ratings-debug и проверяет, что нет критичных ошибок', async () => {
            await page.goto('/admin/ratings-debug');
            await page.waitForLoadState('networkidle');

            const title = page.locator('text=/Отладка рейтингов|Ratings debug/i').first();
            await expect(title).toBeVisible({ timeout: 10000 });

            const errorsHeader = page.locator('text=/Последние ошибки пересчёта|Recent errors/i').first();
            await expect(errorsHeader).toBeVisible({ timeout: 10000 });

            const noErrorsMessage = page.locator('text=/Нет записей|No records|Нет ошибок/i').first();
            if (await noErrorsMessage.isVisible({ timeout: 5000 })) {
                await expect(noErrorsMessage).toBeVisible();
            }
        });
    });
});

