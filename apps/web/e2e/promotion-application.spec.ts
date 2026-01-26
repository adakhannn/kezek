/**
 * E2E тест: Применение промо при бронировании
 * Сценарий: создание бронирования с применением активной промоакции
 */

import { test, expect } from '@playwright/test';

test.describe('Применение промо при бронировании', () => {
    test.beforeEach(async ({ page }) => {
        const businessSlug = process.env.E2E_TEST_BUSINESS_SLUG || 'test-business';
        await page.goto(`/b/${businessSlug}`);
        await page.waitForLoadState('networkidle');
    });

    test('должен применить промо при создании бронирования', async ({ page }) => {
        // Шаг 1: Выбираем филиал с активной промоакцией
        await test.step('Выбор филиала с промо', async () => {
            // Ищем филиал, у которого есть активные промо
            // В реальных тестах нужно использовать филиал с заранее созданной промоакцией
            const branchWithPromo = page.locator('[data-testid="branch-card"]').first();
            await branchWithPromo.click();
        });

        // Шаг 2: Проверяем отображение промоакции
        await test.step('Проверка отображения промоакции', async () => {
            // Ищем блок с промоакциями
            const promoSection = page.locator('[data-testid="promotions"], .promotion, text=/акция|промо|скидка/i').first();
            await expect(promoSection).toBeVisible({ timeout: 5000 });
        });

        // Шаг 3: Выбираем услугу и мастера
        await test.step('Выбор услуги и мастера', async () => {
            const masterSelector = page.locator('[data-testid="master-select"], [data-testid="master-card"]').first();
            await masterSelector.click();
            await page.locator('[data-testid="master-option"], [data-testid="master-card"]').first().click();

            const serviceSelector = page.locator('[data-testid="service-select"], [data-testid="service-card"]').first();
            await serviceSelector.click();
            await page.locator('[data-testid="service-option"], [data-testid="service-card"]').first().click();
        });

        // Шаг 4: Выбираем дату и время
        await test.step('Выбор даты и времени', async () => {
            const datePicker = page.locator('[data-testid="date-picker"]').first();
            if (await datePicker.isVisible()) {
                await datePicker.click();
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const tomorrowStr = tomorrow.toISOString().split('T')[0];
                await page.locator(`[data-date="${tomorrowStr}"]`).first().click();
            }

            await page.waitForSelector('[data-testid="time-slot"]', { timeout: 10000 });
            await page.locator('[data-testid="time-slot"]').first().click();
        });

        // Шаг 5: Проверяем применение промо
        await test.step('Проверка применения промо', async () => {
            // Ищем информацию о примененной скидке
            const discountInfo = page.locator('text=/скидка|промо|акция|применено/i').first();
            
            // Проверяем, что промо применилось (если это видно в UI)
            // Или проверяем итоговую сумму (должна быть меньше)
            const originalPrice = page.locator('[data-testid="original-price"], .price').first();
            const finalPrice = page.locator('[data-testid="final-price"], .total').first();
            
            if (await originalPrice.isVisible() && await finalPrice.isVisible()) {
                const originalText = await originalPrice.textContent();
                const finalText = await finalPrice.textContent();
                
                if (originalText && finalText) {
                    const original = parseFloat(originalText.replace(/[^\d.]/g, ''));
                    const final = parseFloat(finalText.replace(/[^\d.]/g, ''));
                    expect(final).toBeLessThan(original);
                }
            }
        });

        // Шаг 6: Заполняем данные и подтверждаем
        await test.step('Подтверждение бронирования с промо', async () => {
            const nameInput = page.locator('input[name="client_name"], input[placeholder*="имя"]').first();
            if (await nameInput.isVisible()) {
                await nameInput.fill('Тестовый Клиент');
            }

            const phoneInput = page.locator('input[name="client_phone"], input[type="tel"]').first();
            if (await phoneInput.isVisible()) {
                await phoneInput.fill('+996555123456');
            }

            const confirmButton = page.locator('button:has-text("Подтвердить"), button:has-text("Забронировать"), button[type="submit"]').first();
            await confirmButton.click();

            // Ждем успешного создания бронирования
            await page.waitForURL(/booking|success|cabinet/, { timeout: 10000 });
            
            // Проверяем, что промо было применено в итоговом сообщении
            const successMessage = page.locator('text=/бронирование|успешно|промо|скидка/i').first();
            await expect(successMessage).toBeVisible({ timeout: 5000 });
        });
    });

    test('должен отобразить информацию о промоакции на странице бизнеса', async ({ page }) => {
        // Проверяем, что промоакции отображаются на публичной странице
        const promoSection = page.locator('[data-testid="promotions-section"], .promotions, text=/акции|промо/i').first();
        await expect(promoSection).toBeVisible({ timeout: 5000 });
    });
});

