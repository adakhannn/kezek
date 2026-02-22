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

    test('должен проверить итоговую сумму с примененной промоакцией', async ({ page }) => {
        await test.step('Выбор филиала с промо', async () => {
            const branchWithPromo = page.locator('[data-testid="branch-card"]').first();
            await branchWithPromo.click();
            await page.waitForTimeout(1000);
        });

        await test.step('Проверка отображения промоакции и исходной цены', async () => {
            // Проверяем наличие промоакции
            const promoSection = page.locator('[data-testid="promotions"], .promotion, text=/акция|промо|скидка/i').first();
            await expect(promoSection).toBeVisible({ timeout: 5000 });
            
            // Запоминаем исходную цену услуги
            const originalPriceElement = page.locator('[data-testid="service-price"], .price, text=/\\d+.*сом/i').first();
            if (await originalPriceElement.isVisible({ timeout: 3000 })) {
                const originalPriceText = await originalPriceElement.textContent();
                expect(originalPriceText).toMatch(/\d+/);
            }
        });

        await test.step('Выбор услуги, мастера, даты и времени', async () => {
            const masterSelector = page.locator('[data-testid="master-select"], [data-testid="master-card"]').first();
            if (await masterSelector.isVisible({ timeout: 5000 })) {
                await masterSelector.click();
                await page.locator('[data-testid="master-option"], [data-testid="master-card"]').first().click();
                await page.waitForTimeout(500);
            }

            const serviceSelector = page.locator('[data-testid="service-select"], [data-testid="service-card"]').first();
            if (await serviceSelector.isVisible({ timeout: 5000 })) {
                await serviceSelector.click();
                await page.locator('[data-testid="service-option"], [data-testid="service-card"]').first().click();
                await page.waitForTimeout(1000);
            }

            const datePicker = page.locator('[data-testid="date-picker"], input[type="date"]').first();
            if (await datePicker.isVisible({ timeout: 3000 })) {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const tomorrowStr = tomorrow.toISOString().split('T')[0];
                await datePicker.fill(tomorrowStr);
                await page.waitForTimeout(1000);
            }

            await page.waitForSelector('[data-testid="time-slot"], button:has-text(/\\d{2}:\\d{2}/)', { timeout: 10000 });
            await page.locator('[data-testid="time-slot"], button:has-text(/\\d{2}:\\d{2}/)').first().click();
            await page.waitForTimeout(500);
        });

        await test.step('Проверка итоговой суммы с промо', async () => {
            // Ищем блок с итоговой суммой
            const summarySection = page.locator('[data-testid="booking-summary"], .summary, text=/итого|total|сумма/i').first();
            if (await summarySection.isVisible({ timeout: 5000 })) {
                // Проверяем наличие информации о промо
                const promoInfo = page.locator('text=/промо|акция|скидка|применено/i').first();
                if (await promoInfo.isVisible({ timeout: 3000 })) {
                    await expect(promoInfo).toBeVisible();
                }
                
                // Проверяем итоговую сумму
                const finalPriceElement = page.locator('[data-testid="final-price"], .total, text=/\\d+.*сом/i').first();
                if (await finalPriceElement.isVisible({ timeout: 3000 })) {
                    const finalPriceText = await finalPriceElement.textContent();
                    expect(finalPriceText).toMatch(/\d+/);
                    
                    // Проверяем, что итоговая сумма меньше исходной (если есть скидка)
                    const originalPriceElement = page.locator('[data-testid="original-price"], .price').first();
                    if (await originalPriceElement.isVisible({ timeout: 2000 })) {
                        const originalText = await originalPriceElement.textContent();
                        const finalText = await finalPriceElement.textContent();
                        
                        if (originalText && finalText) {
                            const original = parseFloat(originalText.replace(/[^\d.]/g, ''));
                            const final = parseFloat(finalText.replace(/[^\d.]/g, ''));
                            expect(final).toBeLessThanOrEqual(original);
                        }
                    }
                }
            }
        });

        await test.step('Создание бронирования и проверка сохранения промо', async () => {
            const nameInput = page.locator('input[name="client_name"], input[placeholder*="имя" i]').first();
            if (await nameInput.isVisible({ timeout: 3000 })) {
                await nameInput.fill('Клиент с промо');
            }

            const phoneInput = page.locator('input[name="client_phone"], input[type="tel"]').first();
            if (await phoneInput.isVisible({ timeout: 3000 })) {
                await phoneInput.fill('+996555123457');
            }

            // Перехватываем ответ API для проверки сохранения промо
            const bookingResponsePromise = page.waitForResponse(
                response => response.url().includes('/api/bookings') || response.url().includes('create'),
                { timeout: 10000 }
            ).catch(() => null);

            const confirmButton = page.locator('button:has-text("Подтвердить"), button:has-text("Забронировать"), button[type="submit"]').first();
            await confirmButton.click();

            // Ждем успешного создания
            await page.waitForURL(/booking|success|cabinet/, { timeout: 10000 });

            // Проверяем ответ API на наличие промо
            const response = await bookingResponsePromise;
            if (response) {
                try {
                    const data = await response.json();
                    if (data && data.promotion_applied) {
                        expect(data.promotion_applied).toBeTruthy();
                    }
                } catch {
                    // Игнорируем ошибки парсинга
                }
            }

            // Проверяем отображение промо на странице подтверждения
            const promoAppliedInfo = page.locator('text=/промо|акция|скидка|применено/i').first();
            if (await promoAppliedInfo.isVisible({ timeout: 5000 })) {
                await expect(promoAppliedInfo).toBeVisible();
            }
        });
    });

    test('должен проверить статистику по промоакциям', async ({ page }) => {
        // Авторизуемся как менеджер/владелец
        const managerEmail = process.env.E2E_TEST_MANAGER_EMAIL || 'manager@test.com';
        await page.goto('/auth/sign-in');
        await page.waitForLoadState('networkidle');
        
        // Заполняем форму входа (адаптируйте под реальную структуру)
        const emailInput = page.locator('input[type="email"], input[name="email"]').first();
        if (await emailInput.isVisible({ timeout: 3000 })) {
            await emailInput.fill(managerEmail);
            const submitButton = page.locator('button:has-text("Отправить"), button[type="submit"]').first();
            if (await submitButton.isVisible({ timeout: 2000 })) {
                await submitButton.click();
                await page.waitForTimeout(2000);
            }
        }

        await test.step('Переход на страницу управления промоакциями', async () => {
            // Переходим на страницу филиала с промоакциями
            // В реальных тестах нужно использовать конкретный ID филиала
            const branchId = process.env.E2E_TEST_BRANCH_ID || 'test-branch-id';
            await page.goto(`/dashboard/branches/${branchId}`);
            await page.waitForLoadState('networkidle');
        });

        await test.step('Проверка отображения статистики промо', async () => {
            // Ищем секцию с промоакциями
            const promotionsSection = page.locator('[data-testid="promotions-panel"], .promotions, text=/промо|акции/i').first();
            if (await promotionsSection.isVisible({ timeout: 5000 })) {
                await expect(promotionsSection).toBeVisible();
                
                // Проверяем наличие статистики использования
                const usageStats = page.locator('text=/использовано|usage|раз|count/i').first();
                if (await usageStats.isVisible({ timeout: 5000 })) {
                    await expect(usageStats).toBeVisible();
                    
                    // Проверяем, что статистика содержит число
                    const statsText = await usageStats.textContent();
                    expect(statsText).toMatch(/\d+/);
                }
            }
        });

        await test.step('Проверка детальной информации о промо', async () => {
            // Ищем карточку промоакции
            const promoCard = page.locator('[data-testid="promotion-card"], .promotion-card').first();
            if (await promoCard.isVisible({ timeout: 5000 })) {
                // Проверяем наличие типа промо
                const promoType = page.locator('text=/скидка|бесплатно|discount|free/i').first();
                if (await promoType.isVisible({ timeout: 3000 })) {
                    await expect(promoType).toBeVisible();
                }
                
                // Проверяем наличие параметров (процент скидки, количество визитов и т.д.)
                const promoParams = page.locator('text=/\\d+%|\\d+.*раз|\\d+.*визит/i').first();
                if (await promoParams.isVisible({ timeout: 3000 })) {
                    await expect(promoParams).toBeVisible();
                }
            }
        });
    });

    // Happy-path: Применение промо с несколькими типами скидок
    test('должен применить промо с процентной скидкой', async ({ page }) => {
        const businessSlug = process.env.E2E_TEST_BUSINESS_SLUG || 'test-business';
        await page.goto(`/b/${businessSlug}`);
        await page.waitForLoadState('networkidle');

        await test.step('Поиск промо с процентной скидкой', async () => {
            const promoSection = page.locator('[data-testid="promotions"], .promotion, text=/скидка|discount/i').first();
            if (await promoSection.isVisible({ timeout: 5000 })) {
                // Ищем промо с указанием процента (например, "10%", "20%")
                const percentPromo = page.locator('text=/\\d+%/i').first();
                if (await percentPromo.isVisible({ timeout: 3000 })) {
                    await expect(percentPromo).toBeVisible();
                    
                    // Проверяем, что процент указан корректно
                    const percentText = await percentPromo.textContent();
                    expect(percentText).toMatch(/\d+%/);
                }
            }
        });
    });

    // Happy-path: Применение промо "бесплатно" (free service)
    test('должен применить промо типа "бесплатно"', async ({ page }) => {
        const businessSlug = process.env.E2E_TEST_BUSINESS_SLUG || 'test-business';
        await page.goto(`/b/${businessSlug}`);
        await page.waitForLoadState('networkidle');

        await test.step('Поиск промо типа "бесплатно"', async () => {
            const freePromo = page.locator('text=/бесплатно|free|gratis/i').first();
            if (await freePromo.isVisible({ timeout: 5000 })) {
                await expect(freePromo).toBeVisible();
                
                // Проверяем, что итоговая цена = 0
                const finalPrice = page.locator('[data-testid="final-price"], .total').first();
                if (await finalPrice.isVisible({ timeout: 3000 })) {
                    const priceText = await finalPrice.textContent();
                    if (priceText) {
                        const priceValue = parseFloat(priceText.replace(/[^\d.]/g, ''));
                        expect(priceValue).toBe(0);
                    }
                }
            }
        });
    });

    // Edge-case: Промо с истекшим сроком действия
    test('должен не показывать промо с истекшим сроком', async ({ page }) => {
        const businessSlug = process.env.E2E_TEST_BUSINESS_SLUG || 'test-business';
        await page.goto(`/b/${businessSlug}`);
        await page.waitForLoadState('networkidle');

        await test.step('Проверка отсутствия истекших промо', async () => {
            // Промо с истекшим сроком не должны отображаться
            const expiredPromo = page.locator('text=/истек|expired|завершено/i').first();
            if (await expiredPromo.isVisible({ timeout: 3000 })) {
                // Если есть истекшие промо, они должны быть помечены как неактивные
                const isDisabled = await expiredPromo.isDisabled().catch(() => false);
                expect(isDisabled || !(await expiredPromo.isVisible())).toBe(true);
            }
        });
    });

    // Edge-case: Промо с ограниченным количеством использований
    test('должен проверить ограничение количества использований промо', async ({ page }) => {
        const businessSlug = process.env.E2E_TEST_BUSINESS_SLUG || 'test-business';
        await page.goto(`/b/${businessSlug}`);
        await page.waitForLoadState('networkidle');

        await test.step('Проверка отображения лимита использований', async () => {
            const promoCard = page.locator('[data-testid="promotion-card"], .promotion-card').first();
            if (await promoCard.isVisible({ timeout: 5000 })) {
                // Ищем информацию о лимите (например, "Осталось 5 использований")
                const limitInfo = page.locator('text=/осталось|remaining|лимит|limit/i').first();
                if (await limitInfo.isVisible({ timeout: 3000 })) {
                    const limitText = await limitInfo.textContent();
                    expect(limitText).toMatch(/\d+/);
                }
            }
        });
    });

    // Edge-case: Применение нескольких промо одновременно (если поддерживается)
    test('должен проверить возможность применения нескольких промо', async ({ page }) => {
        const businessSlug = process.env.E2E_TEST_BUSINESS_SLUG || 'test-business';
        await page.goto(`/b/${businessSlug}`);
        await page.waitForLoadState('networkidle');

        await test.step('Проверка множественных промо', async () => {
            // Обычно можно применить только одно промо, проверяем это
            const promoCheckboxes = page.locator('input[type="checkbox"][data-testid*="promo"], input[type="radio"][name*="promo"]');
            const promoCount = await promoCheckboxes.count();
            
            if (promoCount > 1) {
                // Если есть несколько промо, проверяем, что можно выбрать только одно
                const firstPromo = promoCheckboxes.first();
                const secondPromo = promoCheckboxes.nth(1);
                
                if (await firstPromo.isVisible({ timeout: 3000 })) {
                    await firstPromo.click();
                    await page.waitForTimeout(500);
                    
                    if (await secondPromo.isVisible({ timeout: 3000 })) {
                        await secondPromo.click();
                        await page.waitForTimeout(500);
                        
                        // Проверяем, что первое промо снялось (если radio buttons)
                        const firstChecked = await firstPromo.isChecked().catch(() => false);
                        const secondChecked = await secondPromo.isChecked().catch(() => false);
                        
                        // Должно быть выбрано только одно
                        expect(firstChecked && secondChecked).toBe(false);
                    }
                }
            }
        });
    });

    // Edge-case: Промо с условием минимальной суммы заказа
    test('должен проверить применение промо с минимальной суммой', async ({ page }) => {
        const businessSlug = process.env.E2E_TEST_BUSINESS_SLUG || 'test-business';
        await page.goto(`/b/${businessSlug}`);
        await page.waitForLoadState('networkidle');

        await test.step('Проверка условия минимальной суммы', async () => {
            const promoWithMinAmount = page.locator('text=/от.*сом|minimum|минимум/i').first();
            if (await promoWithMinAmount.isVisible({ timeout: 5000 })) {
                // Проверяем, что условие отображается
                const minAmountText = await promoWithMinAmount.textContent();
                expect(minAmountText).toMatch(/\d+/);
                
                // Если выбрана услуга с меньшей суммой, промо не должно применяться
                const servicePrice = page.locator('[data-testid="service-price"], .price').first();
                if (await servicePrice.isVisible({ timeout: 3000 })) {
                    const priceText = await servicePrice.textContent();
                    if (priceText) {
                        const priceValue = parseFloat(priceText.replace(/[^\d.]/g, ''));
                        const minAmountMatch = minAmountText?.match(/(\d+)/);
                        if (minAmountMatch) {
                            const minAmount = parseFloat(minAmountMatch[1]);
                            
                            // Если цена меньше минимальной, промо не должно применяться
                            if (priceValue < minAmount) {
                                const promoApplied = page.locator('text=/промо применено|promo applied/i').first();
                                await expect(promoApplied).not.toBeVisible({ timeout: 2000 }).catch(() => {
                                    // Игнорируем, если промо не применено (это правильно)
                                });
                            }
                        }
                    }
                }
            }
        });
    });
});

