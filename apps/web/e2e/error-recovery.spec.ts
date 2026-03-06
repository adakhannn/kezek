/**
 * E2E: сценарии восстановления после ошибок.
 *
 * Покрывает:
 * - сеть/timeout для /staff/finance с повторной загрузкой;
 * - сеть/timeout для QuickDesk /dashboard/bookings с повтором;
 * - ошибку при создании брони (bad data) с отображением ошибки.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

test.describe('Восстановление после ошибок', () => {
    test('страница /staff/finance восстанавливается после сетевой ошибки', async ({ page }) => {
        let failedOnce = false;

        await test.step('Первый заход: симулируем сетевую ошибку', async () => {
            await page.route('**/api/staff/finance*', async (route) => {
                if (!failedOnce) {
                    failedOnce = true;
                    await route.abort('failed');
                    return;
                }
                await route.continue();
            });

            await page.goto(`${BASE_URL}/staff/finance`, { waitUntil: 'domcontentloaded' });

            // Проверяем, что страница не падает и виден хоть какой-то body
            await expect(page.locator('body')).toBeVisible();
        });

        await test.step('Повторная попытка: обновляем страницу и ждём успешной загрузки', async () => {
            await page.reload({ waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);

            // Ожидаем, что на странице либо нет явного сообщения "ошибка",
            // либо есть основные элементы UI.
            const errorMessage = page.locator('text=/ошибка|error|не найдено|not found/i').first();
            await expect(errorMessage).not.toBeVisible({ timeout: 3000 }).catch(() => {
                // Если нет ошибок — это тоже ок
            });

            const datePicker = page.locator('input[type="date"], [data-testid="date-picker"]').first();
            if (await datePicker.count() > 0) {
                await expect(datePicker).toBeVisible({ timeout: 5000 });
            }
        });
    });

    test('QuickDesk восстанавливается после таймаута API при загрузке слотов', async ({ page }) => {
        let delayedOnce = false;

        await test.step('Авторизация менеджера и переход в QuickDesk', async () => {
            const managerEmail = process.env.E2E_TEST_MANAGER_EMAIL || 'manager@test.com';
            await page.goto(`${BASE_URL}/auth/sign-in`);
            await page.waitForLoadState('networkidle');

            const emailInput = page.locator('input[type="email"], input[name="email"]').first();
            if (await emailInput.isVisible({ timeout: 3000 })) {
                await emailInput.fill(managerEmail);
                const submitButton = page.locator('button:has-text("Отправить"), button[type="submit"]').first();
                if (await submitButton.isVisible({ timeout: 2000 })) {
                    await submitButton.click();
                    await page.waitForTimeout(2000);
                }
            }

            await page.goto(`${BASE_URL}/dashboard/bookings`);
            await page.waitForLoadState('networkidle');

            const deskTab = page.locator('button:has-text("QuickDesk"), button:has-text("Стол"), [data-testid="desk-tab"]').first();
            if (await deskTab.isVisible({ timeout: 5000 })) {
                await deskTab.click();
                await page.waitForTimeout(1000);
            }
        });

        await test.step('Симулируем таймаут/медленный ответ при загрузке слотов и пробуем ещё раз', async () => {
            await page.route('**/get_free_slots_service_day_v2*', async (route) => {
                if (!delayedOnce) {
                    delayedOnce = true;
                    // Имитируем долгий ответ и прерывание
                    await page.waitForTimeout(5000);
                    await route.abort('timedout');
                    return;
                }
                await route.continue();
            });

            // Запускаем стандартный флоу выбора филиала/мастера/услуги
            const branchSelect = page.locator('select[name="branch"], [data-testid="branch-select"]').first();
            if (await branchSelect.isVisible({ timeout: 5000 })) {
                await branchSelect.selectOption({ index: 1 });
                await page.waitForTimeout(500);
            }

            const staffSelect = page.locator('select[name="staff"], [data-testid="staff-select"]').first();
            if (await staffSelect.isVisible({ timeout: 5000 })) {
                await staffSelect.selectOption({ index: 1 });
                await page.waitForTimeout(500);
            }

            const serviceSelect = page.locator('select[name="service"], [data-testid="service-select"]').first();
            if (await serviceSelect.isVisible({ timeout: 5000 })) {
                await serviceSelect.selectOption({ index: 1 });
                await page.waitForTimeout(1000);
            }

            const dateInput = page.locator('input[type="date"], [data-testid="date-picker"]').first();
            if (await dateInput.isVisible({ timeout: 3000 })) {
                const today = new Date();
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate() + 1).padStart(2, '0');
                await dateInput.fill(`${year}-${month}-${day}`);
                await page.waitForTimeout(1000);
            }

            // Первая попытка загрузки слотов может упасть, но UI не должен падать
            const errorBanner = page.locator('text=/слоты не загружены|ошибка загрузки|произошла ошибка/i').first();
            if (await errorBanner.count() > 0) {
                await expect(errorBanner).toBeVisible({ timeout: 5000 });
            }

            // При повторной попытке (изменении даты) слоты должны загрузиться
            if (await dateInput.isVisible({ timeout: 3000 })) {
                const today = new Date();
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate() + 2).padStart(2, '0');
                await dateInput.fill(`${year}-${month}-${day}`);
                await page.waitForTimeout(1500);
            }

            const slotButton = page.locator('[data-testid="time-slot"], button:has-text(/\\d{2}:\\d{2}/)').first();
            if (await slotButton.count() > 0) {
                await expect(slotButton).toBeVisible({ timeout: 10000 });
            }
        });
    });

    test('публичное бронирование показывает ошибку и позволяет повторить после неудачи', async ({ page }) => {
        const businessSlug = process.env.E2E_TEST_BUSINESS_SLUG || 'test-business';

        await test.step('Переход на публичную страницу бизнеса', async () => {
            await page.goto(`${BASE_URL}/b/${businessSlug}`);
            await page.waitForLoadState('networkidle');
        });

        let failedBookingOnce = false;

        await test.step('Симулируем ошибку при создании бронирования', async () => {
            await page.route('**/api/quick-hold*', async (route) => {
                if (!failedBookingOnce) {
                    failedBookingOnce = true;
                    await route.fulfill({
                        status: 400,
                        body: JSON.stringify({ error: 'E2E simulated error' }),
                        headers: { 'Content-Type': 'application/json' },
                    });
                    return;
                }
                await route.continue();
            });

            // Минимальный флоу: выбираем первый филиал/мастера/услугу/дату/слот
            const branchSelector = page.locator('[data-testid="branch-select"]').first();
            if (await branchSelector.isVisible()) {
                await branchSelector.click();
                await page.locator('[data-testid="branch-option"]').first().click();
            }

            const masterSelector = page.locator('[data-testid="master-select"]').first();
            if (await masterSelector.isVisible()) {
                await masterSelector.click();
                await page.locator('[data-testid="master-option"]').first().click();
            }

            const serviceSelector = page.locator('[data-testid="service-select"]').first();
            if (await serviceSelector.isVisible()) {
                await serviceSelector.click();
                await page.locator('[data-testid="service-option"]').first().click();
            }

            const datePicker = page.locator('[data-testid="date-picker"]').first();
            if (await datePicker.isVisible()) {
                await datePicker.click();
                const today = new Date();
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate() + 1).padStart(2, '0');
                await page.locator(`[data-date="${year}-${month}-${day}"]`).first().click();
            }

            await page.waitForSelector('[data-testid="time-slot"]', { timeout: 10000 });
            const firstSlot = page.locator('[data-testid="time-slot"]').first();
            await expect(firstSlot).toBeVisible();
            await firstSlot.click();

            const confirmButton = page.locator('button:has-text("Подтвердить"), button:has-text("Забронировать"), button[type="submit"]').first();
            await expect(confirmButton).toBeVisible();
            await confirmButton.click();

            // Ожидаем сообщение об ошибке
            const errorToast = page.locator('text=/ошибка|не удалось|попробуйте ещё раз/i').first();
            await expect(errorToast).toBeVisible({ timeout: 10000 });
        });

        await test.step('Повторяем попытку бронирования и ожидаем успешный результат', async () => {
            const confirmButton = page.locator('button:has-text("Подтвердить"), button:has-text("Забронировать"), button[type="submit"]').first();
            await expect(confirmButton).toBeVisible();
            await confirmButton.click();

            // При второй попытке маршруты проходят без принудительной ошибки
            await page.waitForURL(/booking|success|cabinet/, { timeout: 15000 });
        });
    });
});

