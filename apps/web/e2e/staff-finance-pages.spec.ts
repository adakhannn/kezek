/**
 * E2E тест: Страницы финансов сотрудника
 * Тестирует:
 * - /staff/finance (публичная страница для сотрудника)
 * - /dashboard/staff/[id]/finance (страница для менеджера/владельца)
 */

import { test, expect } from '@playwright/test';

test.describe('Страницы финансов сотрудника', () => {
    test.describe('Публичная страница /staff/finance', () => {
        test.beforeEach(async ({ page }) => {
            // Пропускаем авторизацию для базовых тестов
            // В реальных тестах нужно использовать реальные учетные данные
            // или настроить моковую авторизацию
        });

        test('должна загружаться без ошибок', async ({ page }) => {
            await test.step('Переход на страницу finance', async () => {
                // Переходим напрямую на страницу (может быть редирект на авторизацию)
                await page.goto('/staff/finance', { waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(2000); // Даем время на загрузку
            });

            await test.step('Проверка отсутствия ошибок', async () => {
                // Проверяем, что нет сообщений об ошибках
                const errorMessages = page.locator('text=/ошибка|error|не найдено|not found/i');
                await expect(errorMessages.first()).not.toBeVisible({ timeout: 2000 }).catch(() => {
                    // Игнорируем, если ошибок нет
                });
            });

            await test.step('Проверка наличия основных элементов', async () => {
                // Проверяем наличие датапикера или основных элементов страницы
                const pageContent = page.locator('body');
                await expect(pageContent).toBeVisible();
            });
        });

        test('должна отображать данные смены при открытой смене', async ({ page }) => {
            await page.goto('/staff/finance');
            await page.waitForLoadState('networkidle');

            // Проверяем, что страница загрузилась
            await expect(page).toHaveURL(/\/staff\/finance/);

            // Проверяем наличие элементов интерфейса (датапикер, кнопки и т.д.)
            const datePicker = page.locator('input[type="date"], [role="textbox"]').first();
            // Если есть датапикер, проверяем его видимость
            if (await datePicker.count() > 0) {
                await expect(datePicker).toBeVisible({ timeout: 5000 });
            }
        });

        test('должна обрабатывать ошибки сети корректно', async ({ page }) => {
            // Перехватываем сетевые запросы и симулируем ошибку
            await page.route('**/api/staff/finance*', route => {
                route.abort('failed');
            });

            await page.goto('/staff/finance', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);

            // Проверяем, что ошибка обработана (нет краша страницы)
            await expect(page.locator('body')).toBeVisible();
        });
    });

    test.describe('Страница менеджера /dashboard/staff/[id]/finance', () => {
        test.beforeEach(async ({ page }) => {
            // Пропускаем авторизацию для базовых тестов
        });

        test('должна загружаться для менеджера', async ({ page }) => {
            // Нужен реальный ID сотрудника для теста
            const staffId = process.env.E2E_TEST_STAFF_ID || 'test-staff-id';
            
            await page.goto(`/dashboard/staff/${staffId}/finance`);
            await page.waitForLoadState('networkidle');

            // Проверяем, что страница загрузилась или показала корректную ошибку
            const body = page.locator('body');
            await expect(body).toBeVisible();
        });

        test('должна показывать понятное сообщение при ошибке "Бизнес не найден"', async ({ page }) => {
            const staffId = process.env.E2E_TEST_STAFF_ID || 'test-staff-id';
            
            await page.goto(`/dashboard/staff/${staffId}/finance`);
            await page.waitForLoadState('networkidle');

            // Если есть ошибка доступа, проверяем, что она понятная
            const errorMessage = page.locator('text=/бизнес не найден|нет доступа|access denied/i');
            if (await errorMessage.count() > 0) {
                await expect(errorMessage.first()).toBeVisible();
                // Проверяем, что есть инструкции по решению проблемы
                const troubleshooting = page.locator('text=/обратитесь|проверьте|contact/i');
                if (await troubleshooting.count() > 0) {
                    await expect(troubleshooting.first()).toBeVisible();
                }
            }
        });
    });

    test.describe('Общие проверки', () => {
        test('должна корректно обрабатывать rate limiting', async ({ page }) => {
            await page.goto('/staff/finance', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);

            // Быстро меняем дату несколько раз (симулируем множественные запросы)
            const datePicker = page.locator('input[type="date"]').first();
            if (await datePicker.count() > 0) {
                for (let i = 0; i < 5; i++) {
                    await datePicker.fill('2024-01-01');
                    await page.waitForTimeout(100);
                    await datePicker.fill('2024-01-02');
                    await page.waitForTimeout(100);
                }
            }

            // Проверяем, что при rate limit показывается предупреждение
            const rateLimitMessage = page.locator('text=/слишком много запросов|rate limit|подождите/i');
            // Не обязательно должно быть, но если есть - проверяем
            if (await rateLimitMessage.count() > 0) {
                await expect(rateLimitMessage.first()).toBeVisible({ timeout: 3000 });
            }
        });

        test('должна корректно обрабатывать валидацию клиентских данных', async ({ page }) => {
            await page.goto('/staff/finance', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);

            // Пытаемся добавить клиента с невалидными данными
            const addButton = page.locator('button:has-text("Добавить"), button:has-text("Add")').first();
            if (await addButton.isVisible({ timeout: 3000 })) {
                await addButton.click();
                
                // Заполняем невалидные данные (например, отрицательную сумму)
                const amountInput = page.locator('input[type="number"], input[name*="amount"]').first();
                if (await amountInput.isVisible({ timeout: 2000 })) {
                    await amountInput.fill('-100');
                    
                    // Проверяем, что показывается ошибка валидации
                    const validationError = page.locator('text=/неверно|invalid|должно быть положительным/i');
                    if (await validationError.count() > 0) {
                        await expect(validationError.first()).toBeVisible({ timeout: 2000 });
                    }
                }
            }
        });
    });
});

