/**
 * E2E тест: Управление сменой
 * Сценарий: открытие смены → добавление клиентов → закрытие смены
 */

import { test, expect } from '@playwright/test';

test.describe('Управление сменой сотрудника', () => {
    test.beforeEach(async ({ page }) => {
        // Авторизуемся как сотрудник
        // В реальных тестах нужно использовать тестовые учетные данные
        const staffEmail = process.env.E2E_TEST_STAFF_EMAIL || 'staff@test.com';
        const staffPassword = process.env.E2E_TEST_STAFF_PASSWORD || 'test-password';

        await page.goto('/auth/sign-in');
        
        // Заполняем форму входа
        await page.fill('input[type="email"]', staffEmail);
        await page.fill('input[type="password"]', staffPassword);
        await page.click('button[type="submit"]');

        // Ждем редиректа в кабинет сотрудника
        await page.waitForURL(/staff|dashboard/, { timeout: 10000 });
    });

    test('должен открыть смену, добавить клиентов и закрыть смену', async ({ page }) => {
        // Шаг 1: Открытие смены
        await test.step('Открытие смены', async () => {
            // Переходим на страницу смены или кабинет сотрудника
            await page.goto('/staff');
            await page.waitForLoadState('networkidle');

            // Ищем кнопку "Открыть смену"
            const openShiftButton = page.locator('button:has-text("Открыть смену"), button:has-text("Начать смену")').first();
            await expect(openShiftButton).toBeVisible({ timeout: 5000 });
            await openShiftButton.click();

            // Ждем подтверждения открытия смены
            await page.waitForSelector('text=/смена открыта|смена начата/i', { timeout: 5000 });
        });

        // Шаг 2: Добавление клиентов
        await test.step('Добавление клиентов в смену', async () => {
            // Ищем форму или кнопку для добавления клиента
            const addClientButton = page.locator('button:has-text("Добавить клиента"), button:has-text("Новый клиент")').first();
            if (await addClientButton.isVisible()) {
                await addClientButton.click();
            }

            // Заполняем данные первого клиента
            await page.fill('input[name="client_name"], input[placeholder*="имя"]', 'Клиент 1');
            await page.fill('input[name="service_name"], input[placeholder*="услуга"]', 'Стрижка');
            await page.fill('input[name="service_amount"], input[type="number"]', '1000');
            
            const saveButton = page.locator('button:has-text("Сохранить"), button:has-text("Добавить")').first();
            await saveButton.click();

            // Ждем появления клиента в списке
            await page.waitForSelector('text=Клиент 1', { timeout: 5000 });

            // Добавляем второго клиента
            if (await addClientButton.isVisible()) {
                await addClientButton.click();
                await page.fill('input[name="client_name"], input[placeholder*="имя"]', 'Клиент 2');
                await page.fill('input[name="service_name"], input[placeholder*="услуга"]', 'Окрашивание');
                await page.fill('input[name="service_amount"], input[type="number"]', '2000');
                await saveButton.click();
                await page.waitForSelector('text=Клиент 2', { timeout: 5000 });
            }
        });

        // Шаг 3: Закрытие смены
        await test.step('Закрытие смены', async () => {
            // Ищем кнопку "Закрыть смену"
            const closeShiftButton = page.locator('button:has-text("Закрыть смену"), button:has-text("Завершить смену")').first();
            await expect(closeShiftButton).toBeVisible({ timeout: 5000 });
            await closeShiftButton.click();

            // Если есть модальное окно подтверждения
            const confirmButton = page.locator('button:has-text("Подтвердить"), button:has-text("Да")').first();
            if (await confirmButton.isVisible({ timeout: 2000 })) {
                await confirmButton.click();
            }

            // Ждем подтверждения закрытия смены
            await page.waitForSelector('text=/смена закрыта|смена завершена/i', { timeout: 10000 });

            // Проверяем, что отображается итоговая информация
            const totalAmount = page.locator('text=/итого|сумма|всего/i').first();
            await expect(totalAmount).toBeVisible({ timeout: 5000 });
        });
    });
});

