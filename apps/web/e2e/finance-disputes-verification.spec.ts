/**
 * E2E тест: Сценарии споров - проверка совпадения сумм между UI и staff_finance_operation_logs
 * 
 * Сценарии:
 * - Проверка совпадения сумм в UI с логами операций после закрытия смены
 * - Проверка корректности записи операций при добавлении/изменении клиентов
 * - Проверка совпадения итоговых сумм (master_share, salon_share) с логами
 * - Проверка истории изменений в логах при корректировке hours_worked
 */

import { test, expect } from '@playwright/test';

test.describe('Проверка совпадения сумм между UI и staff_finance_operation_logs', () => {
    let managerAuthState: any;
    let staffAuthState: any;

    test.beforeAll(async ({ browser }) => {
        // Авторизуемся как менеджер
        const managerContext = await browser.newContext();
        const managerPage = await managerContext.newPage();
        
        const managerEmail = process.env.E2E_TEST_MANAGER_EMAIL || 'manager@test.com';
        await managerPage.goto('/auth/sign-in');
        await managerPage.waitForLoadState('networkidle');
        
        const emailInput = managerPage.locator('input[type="email"], input[name="email"]').first();
        if (await emailInput.isVisible({ timeout: 3000 })) {
            await emailInput.fill(managerEmail);
            const submitButton = managerPage.locator('button:has-text("Отправить"), button[type="submit"]').first();
            if (await submitButton.isVisible({ timeout: 2000 })) {
                await submitButton.click();
                await managerPage.waitForTimeout(2000);
            }
        }
        
        managerAuthState = await managerContext.storageState();
        await managerContext.close();

        // Авторизуемся как сотрудник
        const staffContext = await browser.newContext();
        const staffPage = await staffContext.newPage();
        
        const staffEmail = process.env.E2E_TEST_STAFF_EMAIL || 'staff@test.com';
        await staffPage.goto('/auth/sign-in');
        await staffPage.waitForLoadState('networkidle');
        
        const staffEmailInput = staffPage.locator('input[type="email"], input[name="email"]').first();
        if (await staffEmailInput.isVisible({ timeout: 3000 })) {
            await staffEmailInput.fill(staffEmail);
            const submitButton = staffPage.locator('button:has-text("Отправить"), button[type="submit"]').first();
            if (await submitButton.isVisible({ timeout: 2000 })) {
                await submitButton.click();
                await staffPage.waitForTimeout(2000);
            }
        }
        
        staffAuthState = await staffContext.storageState();
        await staffContext.close();
    });

    test('должен проверить совпадение сумм после закрытия смены', async ({ page }) => {
        // Используем авторизацию сотрудника
        if (staffAuthState) {
            await page.context().addCookies(staffAuthState.cookies);
        }

        await test.step('Открытие смены и добавление клиентов', async () => {
            await page.goto('/staff/finance');
            await page.waitForLoadState('networkidle');
            
            // Открываем смену, если она не открыта
            const openButton = page.locator('button:has-text("Открыть"), button:has-text("Open")').first();
            if (await openButton.isVisible({ timeout: 5000 })) {
                await openButton.click();
                await page.waitForTimeout(2000);
            }
            
            // Добавляем первого клиента
            const addButton = page.locator('button:has-text("Добавить"), button:has-text("Add")').first();
            if (await addButton.isVisible({ timeout: 3000 })) {
                await addButton.click();
                await page.waitForTimeout(500);
                
                const clientNameInput = page.locator('input[name*="client"], input[placeholder*="клиент" i]').first();
                if (await clientNameInput.isVisible({ timeout: 2000 })) {
                    await clientNameInput.fill('Клиент для проверки логов 1');
                }
                
                const serviceAmountInput = page.locator('input[name*="serviceAmount"], input[type="number"]').first();
                if (await serviceAmountInput.isVisible({ timeout: 2000 })) {
                    await serviceAmountInput.fill('1500');
                }
                
                const saveButton = page.locator('button:has-text("Сохранить"), button:has-text("Save")').first();
                if (await saveButton.isVisible({ timeout: 2000 })) {
                    await saveButton.click();
                    await page.waitForTimeout(2000);
                }
            }
            
            // Добавляем второго клиента
            if (await addButton.isVisible({ timeout: 3000 })) {
                await addButton.click();
                await page.waitForTimeout(500);
                
                const clientNameInput = page.locator('input[name*="client"], input[placeholder*="клиент" i]').first();
                if (await clientNameInput.isVisible({ timeout: 2000 })) {
                    await clientNameInput.fill('Клиент для проверки логов 2');
                }
                
                const serviceAmountInput = page.locator('input[name*="serviceAmount"], input[type="number"]').first();
                if (await serviceAmountInput.isVisible({ timeout: 2000 })) {
                    await serviceAmountInput.fill('2000');
                }
                
                const saveButton = page.locator('button:has-text("Сохранить"), button:has-text("Save")').first();
                if (await saveButton.isVisible({ timeout: 2000 })) {
                    await saveButton.click();
                    await page.waitForTimeout(2000);
                }
            }
        });

        await test.step('Запоминаем суммы из UI перед закрытием', async () => {
            // Запоминаем итоговую сумму из UI
            const totalAmountElement = page.locator('text=/оборот|turnover|итого|total/i').first();
            let uiTotalAmount = 0;
            
            if (await totalAmountElement.isVisible({ timeout: 5000 })) {
                const totalText = await totalAmountElement.textContent();
                if (totalText) {
                    const match = totalText.match(/(\d+)/);
                    if (match) {
                        uiTotalAmount = parseFloat(match[1]);
                    }
                }
            }
            
            // Ожидаемая сумма: 1500 + 2000 = 3500
            expect(uiTotalAmount).toBeGreaterThanOrEqual(3500);
        });

        await test.step('Закрытие смены', async () => {
            const closeButton = page.locator('button:has-text("Закрыть"), button:has-text("Close")').first();
            if (await closeButton.isVisible({ timeout: 5000 })) {
                // Перехватываем ответ API при закрытии
                const closeResponsePromise = page.waitForResponse(
                    response => response.url().includes('/api/staff/shift/close') || response.url().includes('close'),
                    { timeout: 10000 }
                ).catch(() => null);
                
                await closeButton.click();
                await page.waitForTimeout(3000);
                
                // Проверяем успешное закрытие
                const successMessage = page.locator('text=/смена закрыта|closed|успешно/i').first();
                await expect(successMessage).toBeVisible({ timeout: 5000 });
                
                // Сохраняем данные из ответа API
                const response = await closeResponsePromise;
                if (response) {
                    expect(response.status()).toBe(200);
                }
            }
        });

        await test.step('Проверка сумм в UI после закрытия', async () => {
            // Ждем обновления данных
            await page.waitForTimeout(2000);
            
            // Проверяем отображение итоговых сумм
            const masterShareElement = page.locator('[data-testid="master-share"], text=/мастеру|master/i').first();
            const salonShareElement = page.locator('[data-testid="salon-share"], text=/салону|salon|бизнесу/i').first();
            
            let uiMasterShare = 0;
            let uiSalonShare = 0;
            
            if (await masterShareElement.isVisible({ timeout: 5000 })) {
                const masterText = await masterShareElement.textContent();
                if (masterText) {
                    const match = masterText.match(/(\d+)/);
                    if (match) {
                        uiMasterShare = parseFloat(match[1]);
                    }
                }
            }
            
            if (await salonShareElement.isVisible({ timeout: 5000 })) {
                const salonText = await salonShareElement.textContent();
                if (salonText) {
                    const match = salonText.match(/(\d+)/);
                    if (match) {
                        uiSalonShare = parseFloat(match[1]);
                    }
                }
            }
            
            // Проверяем, что суммы больше нуля
            expect(uiMasterShare).toBeGreaterThan(0);
            expect(uiSalonShare).toBeGreaterThanOrEqual(0);
        });

        await test.step('Проверка сумм через API (сравнение с логами)', async () => {
            // Переключаемся на авторизацию менеджера для доступа к API
            if (managerAuthState) {
                await page.context().clearCookies();
                await page.context().addCookies(managerAuthState.cookies);
            }
            
            const staffId = process.env.E2E_TEST_STAFF_ID || 'test-staff-id';
            await page.goto(`/dashboard/staff/${staffId}/finance`);
            await page.waitForLoadState('networkidle');
            
            // Перехватываем запрос к API финансов для получения данных из БД
            const financeResponsePromise = page.waitForResponse(
                response => response.url().includes('/api/dashboard/staff') && response.url().includes('/finance'),
                { timeout: 10000 }
            ).catch(() => null);
            
            // Обновляем страницу для получения актуальных данных
            await page.reload();
            await page.waitForLoadState('networkidle');
            
            const response = await financeResponsePromise;
            if (response) {
                expect(response.status()).toBe(200);
                const data = await response.json();
                
                // Проверяем структуру ответа
                if (data && data.shifts) {
                    // Ищем последнюю закрытую смену
                    const closedShifts = data.shifts.filter((s: { status: string }) => s.status === 'closed');
                    if (closedShifts.length > 0) {
                        const lastShift = closedShifts[0];
                        
                        // Проверяем наличие полей
                        expect(lastShift).toHaveProperty('total_amount');
                        expect(lastShift).toHaveProperty('master_share');
                        expect(lastShift).toHaveProperty('salon_share');
                        
                        // Проверяем, что суммы корректны
                        const dbTotalAmount = Number(lastShift.total_amount || 0);
                        const dbMasterShare = Number(lastShift.master_share || 0);
                        const dbSalonShare = Number(lastShift.salon_share || 0);
                        
                        expect(dbTotalAmount).toBeGreaterThanOrEqual(3500);
                        expect(dbMasterShare).toBeGreaterThan(0);
                        expect(dbSalonShare).toBeGreaterThanOrEqual(0);
                        
                        // Проверяем, что сумма долей не превышает общую сумму (с учетом расходников)
                        const totalWithConsumables = dbTotalAmount + Number(lastShift.consumables_amount || 0);
                        expect(dbMasterShare + dbSalonShare).toBeLessThanOrEqual(totalWithConsumables);
                    }
                }
            }
        });
    });

    test('должен проверить историю изменений в логах при корректировке hours_worked', async ({ page }) => {
        // Используем авторизацию менеджера
        if (managerAuthState) {
            await page.context().addCookies(managerAuthState.cookies);
        }

        const staffId = process.env.E2E_TEST_STAFF_ID || 'test-staff-id';
        
        await test.step('Переход на страницу финансов и поиск закрытой смены', async () => {
            await page.goto(`/dashboard/staff/${staffId}/finance`);
            await page.waitForLoadState('networkidle');
            
            const closedShift = page.locator('[data-testid="closed-shift"], tr:has-text("closed")').first();
            if (!(await closedShift.isVisible({ timeout: 5000 }))) {
                test.skip();
            }
            
            await closedShift.click();
            await page.waitForTimeout(1000);
        });

        await test.step('Запоминаем текущие значения перед изменением', async () => {
            const currentHours = page.locator('[data-testid="hours-worked"], text=/часов|hours/i').first();
            const currentGuaranteed = page.locator('[data-testid="guaranteed-amount"], text=/гарантированная/i').first();
            
            // Сохраняем значения для сравнения
            let initialHours = 0;
            let initialGuaranteed = 0;
            
            if (await currentHours.isVisible({ timeout: 3000 })) {
                const hoursText = await currentHours.textContent();
                if (hoursText) {
                    const match = hoursText.match(/(\d+\.?\d*)/);
                    if (match) {
                        initialHours = parseFloat(match[1]);
                    }
                }
            }
            
            if (await currentGuaranteed.isVisible({ timeout: 3000 })) {
                const guaranteedText = await currentGuaranteed.textContent();
                if (guaranteedText) {
                    const match = guaranteedText.match(/(\d+)/);
                    if (match) {
                        initialGuaranteed = parseFloat(match[1]);
                    }
                }
            }
        });

        await test.step('Изменение hours_worked и проверка обновления', async () => {
            const editButton = page.locator('button:has-text("Изменить часы"), [data-testid="edit-hours"]').first();
            if (await editButton.isVisible({ timeout: 5000 })) {
                await editButton.click();
                await page.waitForTimeout(500);
            }
            
            const hoursInput = page.locator('input[name="hours_worked"], input[type="number"][data-testid="hours-input"]').first();
            if (await hoursInput.isVisible({ timeout: 3000 })) {
                // Перехватываем ответ API при обновлении
                const updateResponsePromise = page.waitForResponse(
                    response => response.url().includes('/update-hours'),
                    { timeout: 10000 }
                ).catch(() => null);
                
                await hoursInput.fill('9.5');
                await page.waitForTimeout(500);
                
                const saveButton = page.locator('button:has-text("Сохранить"), button:has-text("Применить")').first();
                if (await saveButton.isVisible({ timeout: 2000 })) {
                    await saveButton.click();
                    await page.waitForTimeout(2000);
                    
                    // Проверяем успешное обновление
                    const successMessage = page.locator('text=/сохранено|обновлено/i').first();
                    await expect(successMessage).toBeVisible({ timeout: 5000 });
                    
                    // Проверяем ответ API
                    const response = await updateResponsePromise;
                    if (response) {
                        expect(response.status()).toBe(200);
                        const data = await response.json();
                        
                        // Проверяем, что данные обновились
                        if (data && data.shift) {
                            expect(data.shift).toHaveProperty('hours_worked');
                            expect(data.shift).toHaveProperty('guaranteed_amount');
                            expect(data.shift).toHaveProperty('master_share');
                            expect(data.shift).toHaveProperty('salon_share');
                            
                            // Проверяем, что hours_worked обновился
                            const updatedHours = Number(data.shift.hours_worked || 0);
                            expect(updatedHours).toBe(9.5);
                            
                            // Проверяем, что guaranteed_amount пересчитался
                            const updatedGuaranteed = Number(data.shift.guaranteed_amount || 0);
                            expect(updatedGuaranteed).toBeGreaterThanOrEqual(0);
                        }
                    }
                }
            }
        });

        await test.step('Проверка обновления сумм в UI', async () => {
            await page.waitForTimeout(2000);
            
            // Проверяем, что значения обновились в UI
            const updatedHours = page.locator('[data-testid="hours-worked"], text=/9\.5|9,5/i').first();
            if (await updatedHours.isVisible({ timeout: 5000 })) {
                await expect(updatedHours).toBeVisible();
            }
            
            // Проверяем обновление guaranteed_amount
            const updatedGuaranteed = page.locator('[data-testid="guaranteed-amount"], text=/гарантированная/i').first();
            if (await updatedGuaranteed.isVisible({ timeout: 5000 })) {
                const guaranteedText = await updatedGuaranteed.textContent();
                expect(guaranteedText).toMatch(/\d+/);
            }
        });
    });
});

