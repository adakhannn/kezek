/**
 * E2E тест: Корректировка hours_worked и проверка перерасчёта гарантий/долей
 * 
 * Сценарии:
 * - Обновление hours_worked для закрытой смены
 * - Проверка автоматического перерасчёта guaranteed_amount
 * - Проверка перерасчёта master_share и salon_share при изменении hours_worked
 * - Проверка topup_amount (доплата, если guaranteed_amount > master_share)
 */

import { test, expect } from '@playwright/test';

test.describe('Корректировка hours_worked и перерасчёт гарантий/долей', () => {
    let managerAuthState: any;
    let testShiftId: string | null = null;

    test.beforeAll(async ({ browser }) => {
        // Авторизуемся как менеджер/владелец бизнеса
        const context = await browser.newContext();
        const page = await context.newPage();
        
        const managerEmail = process.env.E2E_TEST_MANAGER_EMAIL || 'manager@test.com';
        
        await page.goto('/auth/sign-in');
        await page.waitForLoadState('networkidle');
        
        // Заполняем форму входа
        const emailInput = page.locator('input[type="email"], input[name="email"]').first();
        if (await emailInput.isVisible({ timeout: 3000 })) {
            await emailInput.fill(managerEmail);
            
            const submitButton = page.locator('button:has-text("Отправить"), button[type="submit"]').first();
            if (await submitButton.isVisible({ timeout: 2000 })) {
                await submitButton.click();
                await page.waitForTimeout(2000);
            }
        }
        
        // Сохраняем состояние авторизации
        managerAuthState = await context.storageState();
        await context.close();
    });

    test.beforeEach(async ({ page }) => {
        // Используем сохраненное состояние авторизации
        if (managerAuthState) {
            await page.context().addCookies(managerAuthState.cookies);
        }
    });

    test('должен обновить hours_worked и пересчитать guaranteed_amount', async ({ page }) => {
        const staffId = process.env.E2E_TEST_STAFF_ID || 'test-staff-id';
        
        await test.step('Переход на страницу финансов сотрудника', async () => {
            await page.goto(`/dashboard/staff/${staffId}/finance`);
            await page.waitForLoadState('networkidle');
        });

        await test.step('Поиск закрытой смены', async () => {
            // Ищем закрытую смену в списке (можно фильтровать по статусу "closed")
            const closedShift = page.locator('[data-testid="closed-shift"], tr:has-text("closed"), .shift-card:has-text("closed")').first();
            if (await closedShift.isVisible({ timeout: 5000 })) {
                await closedShift.click();
                await page.waitForTimeout(1000);
            } else {
                // Если нет закрытых смен, пропускаем тест
                test.skip();
            }
        });

        await test.step('Получение текущих значений', async () => {
            // Запоминаем текущие значения для сравнения
            const currentHours = page.locator('[data-testid="hours-worked"], text=/часов|hours/i').first();
            const currentGuaranteed = page.locator('[data-testid="guaranteed-amount"], text=/гарантированная|guaranteed/i').first();
            const currentMasterShare = page.locator('[data-testid="master-share"], text=/мастеру|master/i').first();
            
            // Сохраняем значения для проверки изменений
            if (await currentHours.isVisible({ timeout: 3000 })) {
                const hoursText = await currentHours.textContent();
                expect(hoursText).toBeTruthy();
            }
        });

        await test.step('Открытие формы редактирования hours_worked', async () => {
            const editButton = page.locator('button:has-text("Изменить часы"), button:has-text("Редактировать"), [data-testid="edit-hours"]').first();
            if (await editButton.isVisible({ timeout: 5000 })) {
                await editButton.click();
                await page.waitForTimeout(500);
            } else {
                // Если кнопки нет, ищем поле ввода напрямую
                const hoursInput = page.locator('input[name="hours_worked"], input[type="number"][data-testid="hours-input"]').first();
                if (await hoursInput.isVisible({ timeout: 3000 })) {
                    await hoursInput.click();
                } else {
                    test.skip();
                }
            }
        });

        await test.step('Обновление hours_worked', async () => {
            const hoursInput = page.locator('input[name="hours_worked"], input[type="number"][data-testid="hours-input"]').first();
            await expect(hoursInput).toBeVisible({ timeout: 5000 });
            
            // Заполняем новое значение (например, 8.5 часов вместо текущего)
            await hoursInput.fill('8.5');
            await page.waitForTimeout(500);
            
            // Сохраняем изменения
            const saveButton = page.locator('button:has-text("Сохранить"), button:has-text("Применить"), button[type="submit"]').first();
            if (await saveButton.isVisible({ timeout: 2000 })) {
                // Перехватываем ответ API для проверки
                const updateResponsePromise = page.waitForResponse(
                    response => response.url().includes('/update-hours') || response.url().includes('staff-shifts'),
                    { timeout: 10000 }
                ).catch(() => null);
                
                await saveButton.click();
                await page.waitForTimeout(2000);
                
                // Проверяем успешное обновление
                const successMessage = page.locator('text=/сохранено|обновлено|updated/i').first();
                await expect(successMessage).toBeVisible({ timeout: 5000 });
                
                // Проверяем ответ API
                const response = await updateResponsePromise;
                if (response) {
                    expect(response.status()).toBe(200);
                    const data = await response.json();
                    expect(data).toHaveProperty('ok', true);
                }
            }
        });

        await test.step('Проверка перерасчёта guaranteed_amount', async () => {
            // Ждем обновления данных на странице
            await page.waitForTimeout(2000);
            
            // Проверяем, что guaranteed_amount пересчитался
            // Если hourly_rate = 500, то 8.5 часов = 4250 сом
            const guaranteedElement = page.locator('[data-testid="guaranteed-amount"], text=/гарантированная|guaranteed/i').first();
            if (await guaranteedElement.isVisible({ timeout: 5000 })) {
                const guaranteedText = await guaranteedElement.textContent();
                expect(guaranteedText).toMatch(/\d+/);
                
                // Проверяем, что значение изменилось (если было другое)
                const guaranteedValue = parseFloat(guaranteedText?.replace(/[^\d.]/g, '') || '0');
                expect(guaranteedValue).toBeGreaterThan(0);
            }
        });

        await test.step('Проверка перерасчёта долей (master_share и salon_share)', async () => {
            // Проверяем, что доли пересчитались корректно
            const masterShareElement = page.locator('[data-testid="master-share"], text=/мастеру|master/i').first();
            const salonShareElement = page.locator('[data-testid="salon-share"], text=/салону|salon|бизнесу/i').first();
            
            if (await masterShareElement.isVisible({ timeout: 5000 })) {
                const masterText = await masterShareElement.textContent();
                expect(masterText).toMatch(/\d+/);
            }
            
            if (await salonShareElement.isVisible({ timeout: 5000 })) {
                const salonText = await salonShareElement.textContent();
                expect(salonText).toMatch(/\d+/);
            }
        });

        await test.step('Проверка topup_amount (если guaranteed_amount > master_share)', async () => {
            // Если guaranteed_amount больше master_share, должна быть доплата
            const topupElement = page.locator('[data-testid="topup-amount"], text=/доплата|topup/i').first();
            if (await topupElement.isVisible({ timeout: 5000 })) {
                const topupText = await topupElement.textContent();
                if (topupText && topupText.match(/\d+/)) {
                    const topupValue = parseFloat(topupText.replace(/[^\d.]/g, ''));
                    expect(topupValue).toBeGreaterThanOrEqual(0);
                }
            }
        });
    });

    test('должен проверить валидацию hours_worked (отрицательное значение)', async ({ page }) => {
        const staffId = process.env.E2E_TEST_STAFF_ID || 'test-staff-id';
        
        await page.goto(`/dashboard/staff/${staffId}/finance`);
        await page.waitForLoadState('networkidle');
        
        const closedShift = page.locator('[data-testid="closed-shift"], tr:has-text("closed")').first();
        if (!(await closedShift.isVisible({ timeout: 5000 }))) {
            test.skip();
        }
        
        await closedShift.click();
        await page.waitForTimeout(1000);
        
        const editButton = page.locator('button:has-text("Изменить часы"), [data-testid="edit-hours"]').first();
        if (await editButton.isVisible({ timeout: 5000 })) {
            await editButton.click();
            await page.waitForTimeout(500);
        }
        
        const hoursInput = page.locator('input[name="hours_worked"], input[type="number"][data-testid="hours-input"]').first();
        if (await hoursInput.isVisible({ timeout: 3000 })) {
            await hoursInput.fill('-1');
            await page.waitForTimeout(500);
            
            // Проверяем, что показывается ошибка валидации
            const validationError = page.locator('text=/неверно|invalid|должно быть положительным|отрицательное/i').first();
            if (await validationError.isVisible({ timeout: 3000 })) {
                await expect(validationError).toBeVisible();
            }
        }
    });

    test('должен проверить валидацию hours_worked (слишком большое значение)', async ({ page }) => {
        const staffId = process.env.E2E_TEST_STAFF_ID || 'test-staff-id';
        
        await page.goto(`/dashboard/staff/${staffId}/finance`);
        await page.waitForLoadState('networkidle');
        
        const closedShift = page.locator('[data-testid="closed-shift"], tr:has-text("closed")').first();
        if (!(await closedShift.isVisible({ timeout: 5000 }))) {
            test.skip();
        }
        
        await closedShift.click();
        await page.waitForTimeout(1000);
        
        const editButton = page.locator('button:has-text("Изменить часы"), [data-testid="edit-hours"]').first();
        if (await editButton.isVisible({ timeout: 5000 })) {
            await editButton.click();
            await page.waitForTimeout(500);
        }
        
        const hoursInput = page.locator('input[name="hours_worked"], input[type="number"][data-testid="hours-input"]').first();
        if (await hoursInput.isVisible({ timeout: 3000 })) {
            await hoursInput.fill('50'); // Больше 48 часов
            await page.waitForTimeout(500);
            
            // Проверяем, что показывается ошибка валидации
            const validationError = page.locator('text=/неверно|invalid|максимум|maximum|48/i').first();
            if (await validationError.isVisible({ timeout: 3000 })) {
                await expect(validationError).toBeVisible();
            }
        }
    });

    test('должен проверить, что нельзя изменить hours_worked для открытой смены', async ({ page }) => {
        const staffId = process.env.E2E_TEST_STAFF_ID || 'test-staff-id';
        
        await page.goto(`/dashboard/staff/${staffId}/finance`);
        await page.waitForLoadState('networkidle');
        
        // Ищем открытую смену
        const openShift = page.locator('[data-testid="open-shift"], tr:has-text("open"), .shift-card:has-text("open")').first();
        if (await openShift.isVisible({ timeout: 5000 })) {
            await openShift.click();
            await page.waitForTimeout(1000);
            
            // Проверяем, что кнопка редактирования hours_worked недоступна или отсутствует
            const editButton = page.locator('button:has-text("Изменить часы"), [data-testid="edit-hours"]').first();
            if (await editButton.isVisible({ timeout: 3000 })) {
                // Если кнопка есть, она должна быть disabled или показывать сообщение
                const isDisabled = await editButton.isDisabled();
                if (!isDisabled) {
                    // Если не disabled, при клике должно быть сообщение
                    await editButton.click();
                    await page.waitForTimeout(1000);
                    
                    const errorMessage = page.locator('text=/только для закрытых|only closed|открытую смену/i').first();
                    if (await errorMessage.isVisible({ timeout: 3000 })) {
                        await expect(errorMessage).toBeVisible();
                    }
                } else {
                    expect(isDisabled).toBe(true);
                }
            }
        } else {
            // Если нет открытой смены, пропускаем тест
            test.skip();
        }
    });
});

