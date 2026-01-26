/**
 * E2E тест: Полный цикл бронирования
 * Сценарий: выбор филиала → мастера → услуги → времени → подтверждение
 */

import { test, expect } from '@playwright/test';

test.describe('Полный цикл бронирования', () => {
    test.beforeEach(async ({ page }) => {
        // Переходим на страницу бизнеса (используем тестовый slug)
        // В реальных тестах нужно использовать тестовый бизнес из test database
        const businessSlug = process.env.E2E_TEST_BUSINESS_SLUG || 'test-business';
        await page.goto(`/b/${businessSlug}`);
    });

    test('должен пройти полный цикл бронирования', async ({ page }) => {
        // Шаг 1: Выбор филиала
        await test.step('Выбор филиала', async () => {
            // Ждем загрузки страницы
            await page.waitForLoadState('networkidle');
            
            // Ищем кнопку или элемент для выбора филиала
            // Адаптируйте селекторы под реальную структуру UI
            const branchSelector = page.locator('[data-testid="branch-select"]').first();
            if (await branchSelector.isVisible()) {
                await branchSelector.click();
                // Выбираем первый доступный филиал
                await page.locator('[data-testid="branch-option"]').first().click();
            }
        });

        // Шаг 2: Выбор мастера
        await test.step('Выбор мастера', async () => {
            const masterSelector = page.locator('[data-testid="master-select"]').first();
            if (await masterSelector.isVisible()) {
                await masterSelector.click();
                await page.locator('[data-testid="master-option"]').first().click();
            } else {
                // Если мастера отображаются сразу, выбираем первого
                await page.locator('[data-testid="master-card"]').first().click();
            }
        });

        // Шаг 3: Выбор услуги
        await test.step('Выбор услуги', async () => {
            const serviceSelector = page.locator('[data-testid="service-select"]').first();
            if (await serviceSelector.isVisible()) {
                await serviceSelector.click();
                await page.locator('[data-testid="service-option"]').first().click();
            } else {
                await page.locator('[data-testid="service-card"]').first().click();
            }
        });

        // Шаг 4: Выбор даты
        await test.step('Выбор даты', async () => {
            const datePicker = page.locator('[data-testid="date-picker"]').first();
            if (await datePicker.isVisible()) {
                await datePicker.click();
                // Выбираем завтрашний день (первый доступный)
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const tomorrowStr = tomorrow.toISOString().split('T')[0];
                await page.locator(`[data-date="${tomorrowStr}"]`).first().click();
            }
        });

        // Шаг 5: Выбор времени
        await test.step('Выбор времени', async () => {
            // Ждем загрузки доступных слотов
            await page.waitForSelector('[data-testid="time-slot"]', { timeout: 10000 });
            const firstSlot = page.locator('[data-testid="time-slot"]').first();
            await expect(firstSlot).toBeVisible();
            await firstSlot.click();
        });

        // Шаг 6: Заполнение данных клиента (если требуется)
        await test.step('Заполнение данных клиента', async () => {
            const nameInput = page.locator('input[name="client_name"], input[placeholder*="имя"], input[placeholder*="Имя"]').first();
            if (await nameInput.isVisible()) {
                await nameInput.fill('Тестовый Клиент');
            }

            const phoneInput = page.locator('input[name="client_phone"], input[type="tel"]').first();
            if (await phoneInput.isVisible()) {
                await phoneInput.fill('+996555123456');
            }

            const emailInput = page.locator('input[name="client_email"], input[type="email"]').first();
            if (await emailInput.isVisible()) {
                await emailInput.fill('test@example.com');
            }
        });

        // Шаг 7: Подтверждение бронирования
        await test.step('Подтверждение бронирования', async () => {
            const confirmButton = page.locator('button:has-text("Подтвердить"), button:has-text("Забронировать"), button[type="submit"]').first();
            await expect(confirmButton).toBeVisible();
            await confirmButton.click();

            // Ждем успешного подтверждения
            // Может быть модальное окно, редирект или сообщение об успехе
            await page.waitForURL(/booking|success|cabinet/, { timeout: 10000 });
            
            // Проверяем, что бронирование создано
            const successMessage = page.locator('text=/бронирование|успешно|подтверждено/i').first();
            await expect(successMessage).toBeVisible({ timeout: 5000 });
        });
    });
});

