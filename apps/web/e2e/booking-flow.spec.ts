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

    test('должен пройти полный цикл бронирования с гостем (без регистрации)', async ({ page }) => {
        await page.waitForLoadState('networkidle');

        await test.step('Шаг 1: Выбор филиала', async () => {
            const branchSelect = page.locator('select').first();
            if (await branchSelect.isVisible({ timeout: 5000 })) {
                await branchSelect.selectOption({ index: 1 });
                await page.waitForTimeout(500);
            }
            const nextBtn = page.locator('button:has-text("Далее")').first();
            if (await nextBtn.isVisible({ timeout: 2000 })) await nextBtn.click();
        });

        await test.step('Шаг 2: Выбор дня', async () => {
            const dateInput = page.locator('input[type="date"]').first();
            if (await dateInput.isVisible({ timeout: 5000 })) {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                await dateInput.fill(tomorrow.toISOString().split('T')[0]);
                await page.waitForTimeout(500);
            }
            const nextBtn = page.locator('button:has-text("Далее")').first();
            if (await nextBtn.isVisible({ timeout: 2000 })) await nextBtn.click();
        });

        await test.step('Шаг 3: Выбор мастера', async () => {
            const staffSelect = page.locator('select').first();
            if (await staffSelect.isVisible({ timeout: 5000 })) {
                await staffSelect.selectOption({ index: 1 });
                await page.waitForTimeout(500);
            }
            const nextBtn = page.locator('button:has-text("Далее")').first();
            if (await nextBtn.isVisible({ timeout: 2000 })) await nextBtn.click();
        });

        await test.step('Шаг 4: Выбор услуги', async () => {
            const serviceSelect = page.locator('select').first();
            if (await serviceSelect.isVisible({ timeout: 5000 })) {
                await serviceSelect.selectOption({ index: 1 });
                await page.waitForTimeout(1000);
            }
            const nextBtn = page.locator('button:has-text("Далее")').first();
            if (await nextBtn.isVisible({ timeout: 2000 })) await nextBtn.click();
        });

        await test.step('Шаг 5: Выбор времени и выбор "Запись без регистрации"', async () => {
            const slotBtn = page.locator('button').filter({ hasText: /^\d{1,2}:\d{2}$/ }).first();
            await expect(slotBtn).toBeVisible({ timeout: 15000 });
            await slotBtn.click();
            await page.waitForTimeout(1000);

            const guestButton = page.locator('button:has-text("Запись без регистрации"), button:has-text("без регистрации")').first();
            await expect(guestButton).toBeVisible({ timeout: 5000 });
            await guestButton.click();
            await page.waitForTimeout(500);
        });

        await test.step('Заполнение данных гостя и подтверждение', async () => {
            const nameInput = page.locator('input[placeholder*="имя" i], input[name="name"]').first();
            await expect(nameInput).toBeVisible({ timeout: 5000 });
            await nameInput.fill('Гость E2E');
            const phoneInput = page.locator('input[type="tel"], input[placeholder*="996"]').first();
            await expect(phoneInput).toBeVisible({ timeout: 3000 });
            await phoneInput.fill('+996555000001');

            const submitBtn = page.locator('button:has-text("Забронировать"), button:has-text("Создать")').first();
            await expect(submitBtn).toBeVisible({ timeout: 3000 });
            await submitBtn.click();
        });

        await test.step('Проверка успешного бронирования', async () => {
            const success = page.locator('text=/успешно|создана|подтверждено|бронирование/i').first();
            await expect(success).toBeVisible({ timeout: 10000 });
        });
    });
});

