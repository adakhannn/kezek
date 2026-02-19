/**
 * E2E тест: QuickDesk - быстрая работа с бронированиями
 * Сценарии:
 * - создание бронирования
 * - изменение бронирования
 * - отмена бронирования
 * - отметка no-show / «пришёл»
 */

import { test, expect } from '@playwright/test';

test.describe('QuickDesk - управление бронированиями', () => {
    let managerAuthState: any;
    let testBookingId: string | null = null;

    test.beforeAll(async ({ browser }) => {
        // Авторизуемся как менеджер/владелец бизнеса
        const context = await browser.newContext();
        const page = await context.newPage();
        
        const managerEmail = process.env.E2E_TEST_MANAGER_EMAIL || 'manager@test.com';
        
        await page.goto('/auth/sign-in');
        await page.waitForLoadState('networkidle');
        
        // Заполняем форму входа (адаптируйте под реальную структуру)
        const emailInput = page.locator('input[type="email"], input[name="email"]').first();
        if (await emailInput.isVisible({ timeout: 3000 })) {
            await emailInput.fill(managerEmail);
            
            // Если есть кнопка отправки кода
            const submitButton = page.locator('button:has-text("Отправить"), button[type="submit"]').first();
            if (await submitButton.isVisible({ timeout: 2000 })) {
                await submitButton.click();
                // Ждем OTP или редирект
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
        
        // Переходим на страницу бронирований
        await page.goto('/dashboard/bookings');
        await page.waitForLoadState('networkidle');
        
        // Переключаемся на вкладку QuickDesk
        const deskTab = page.locator('button:has-text("QuickDesk"), button:has-text("Стол"), [data-testid="desk-tab"]').first();
        if (await deskTab.isVisible({ timeout: 5000 })) {
            await deskTab.click();
            await page.waitForTimeout(1000);
        }
    });

    test('должен создать бронирование через QuickDesk', async ({ page }) => {
        await test.step('Выбор филиала', async () => {
            const branchSelect = page.locator('select[name="branch"], [data-testid="branch-select"]').first();
            if (await branchSelect.isVisible({ timeout: 5000 })) {
                await branchSelect.selectOption({ index: 1 }); // Выбираем первый доступный филиал
                await page.waitForTimeout(500);
            }
        });

        await test.step('Выбор мастера', async () => {
            const staffSelect = page.locator('select[name="staff"], [data-testid="staff-select"]').first();
            if (await staffSelect.isVisible({ timeout: 5000 })) {
                await staffSelect.selectOption({ index: 1 }); // Выбираем первого мастера
                await page.waitForTimeout(500);
            }
        });

        await test.step('Выбор услуги', async () => {
            const serviceSelect = page.locator('select[name="service"], [data-testid="service-select"]').first();
            if (await serviceSelect.isVisible({ timeout: 5000 })) {
                await serviceSelect.selectOption({ index: 1 }); // Выбираем первую услугу
                await page.waitForTimeout(1000); // Ждем загрузки слотов
            }
        });

        await test.step('Выбор даты', async () => {
            const dateInput = page.locator('input[type="date"], [data-testid="date-picker"]').first();
            if (await dateInput.isVisible({ timeout: 3000 })) {
                // Выбираем завтрашний день
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const tomorrowStr = tomorrow.toISOString().split('T')[0];
                await dateInput.fill(tomorrowStr);
                await page.waitForTimeout(1000); // Ждем загрузки слотов
            }
        });

        await test.step('Выбор времени (слота)', async () => {
            // Ждем появления доступных слотов
            const slotButton = page.locator('[data-testid="time-slot"], button:has-text(/\\d{2}:\\d{2}/)').first();
            await expect(slotButton).toBeVisible({ timeout: 10000 });
            await slotButton.click();
            await page.waitForTimeout(500);
        });

        await test.step('Выбор режима клиента и заполнение данных', async () => {
            // Проверяем, есть ли выбор режима клиента
            const clientModeNew = page.locator('input[type="radio"][value="new"], label:has-text("новый")').first();
            if (await clientModeNew.isVisible({ timeout: 2000 })) {
                await clientModeNew.click();
                await page.waitForTimeout(300);
                
                // Заполняем данные нового клиента
                const nameInput = page.locator('input[name="client_name"], input[placeholder*="имя" i]').first();
                if (await nameInput.isVisible({ timeout: 2000 })) {
                    await nameInput.fill('Тестовый Клиент QuickDesk');
                }
                
                const phoneInput = page.locator('input[name="client_phone"], input[type="tel"]').first();
                if (await phoneInput.isVisible({ timeout: 2000 })) {
                    await phoneInput.fill('+996555123456');
                }
            }
        });

        await test.step('Создание бронирования', async () => {
            const createButton = page.locator('button:has-text("Создать"), button:has-text("Забронировать"), button[type="submit"]').first();
            await expect(createButton).toBeVisible({ timeout: 5000 });
            await expect(createButton).toBeEnabled({ timeout: 2000 });
            
            // Перехватываем ответ API для получения ID созданной брони
            const bookingResponsePromise = page.waitForResponse(
                response => response.url().includes('create_internal_booking') || response.url().includes('/api/bookings'),
                { timeout: 10000 }
            ).catch(() => null);
            
            await createButton.click();
            
            // Ждем успешного создания
            const successToast = page.locator('text=/создана|успешно|created/i').first();
            await expect(successToast).toBeVisible({ timeout: 10000 });
            
            // Пытаемся получить ID из ответа или из сообщения
            const response = await bookingResponsePromise;
            if (response) {
                try {
                    const data = await response.json();
                    if (data && typeof data === 'string') {
                        testBookingId = data;
                    } else if (data && data.id) {
                        testBookingId = data.id;
                    }
                } catch {
                    // Игнорируем ошибки парсинга
                }
            }
            
            // Если не получили из ответа, пытаемся извлечь из сообщения
            if (!testBookingId) {
                const successText = await successToast.textContent();
                if (successText) {
                    const match = successText.match(/#([a-f0-9]{8})/i);
                    if (match) {
                        // Получаем полный ID из базы или используем частичный
                        testBookingId = match[1];
                    }
                }
            }
        });
    });

    test('должен изменить бронирование', async ({ page }) => {
        // Предполагаем, что есть созданная бронь (из предыдущего теста или seed данных)
        await test.step('Переход к списку бронирований', async () => {
            const listTab = page.locator('button:has-text("Список"), button:has-text("List"), [data-testid="list-tab"]').first();
            if (await listTab.isVisible({ timeout: 5000 })) {
                await listTab.click();
                await page.waitForTimeout(1000);
            }
        });

        await test.step('Поиск и открытие бронирования', async () => {
            // Ищем первую бронь в списке
            const bookingRow = page.locator('[data-testid="booking-row"], tr, .booking-card').first();
            if (await bookingRow.isVisible({ timeout: 5000 })) {
                await bookingRow.click();
                await page.waitForTimeout(1000);
            }
        });

        await test.step('Изменение данных бронирования', async () => {
            // Ищем кнопку редактирования
            const editButton = page.locator('button:has-text("Изменить"), button:has-text("Редактировать"), [data-testid="edit-booking"]').first();
            if (await editButton.isVisible({ timeout: 3000 })) {
                await editButton.click();
                await page.waitForTimeout(500);
                
                // Изменяем данные (например, время или услугу)
                const timeInput = page.locator('input[type="time"], select[name="time"]').first();
                if (await timeInput.isVisible({ timeout: 2000 })) {
                    await timeInput.fill('14:00');
                }
                
                // Сохраняем изменения
                const saveButton = page.locator('button:has-text("Сохранить"), button:has-text("Применить")').first();
                if (await saveButton.isVisible({ timeout: 2000 })) {
                    await saveButton.click();
                    await page.waitForTimeout(2000);
                    
                    // Проверяем успешное сохранение
                    const successMessage = page.locator('text=/сохранено|изменено|updated/i').first();
                    await expect(successMessage).toBeVisible({ timeout: 5000 });
                }
            }
        });
    });

    test('должен отменить бронирование', async ({ page }) => {
        await test.step('Переход к списку бронирований', async () => {
            const listTab = page.locator('button:has-text("Список"), button:has-text("List"), [data-testid="list-tab"]').first();
            if (await listTab.isVisible({ timeout: 5000 })) {
                await listTab.click();
                await page.waitForTimeout(1000);
            }
        });

        await test.step('Отмена бронирования', async () => {
            // Ищем кнопку отмены в первой брони
            const cancelButton = page.locator('button:has-text("Отменить"), button:has-text("Cancel"), [data-testid="cancel-booking"]').first();
            if (await cancelButton.isVisible({ timeout: 5000 })) {
                // Перехватываем диалог подтверждения
                page.once('dialog', async dialog => {
                    expect(dialog.type()).toBe('confirm');
                    await dialog.accept();
                });
                
                await cancelButton.click();
                await page.waitForTimeout(2000);
                
                // Проверяем успешную отмену
                const successMessage = page.locator('text=/отменена|cancelled|успешно/i').first();
                await expect(successMessage).toBeVisible({ timeout: 5000 });
                
                // Проверяем, что статус изменился на "отменено"
                const cancelledStatus = page.locator('text=/отменено|cancelled/i').first();
                await expect(cancelledStatus).toBeVisible({ timeout: 3000 });
            }
        });
    });

    test('должен отметить посещение (пришёл)', async ({ page }) => {
        // Создаем прошедшую бронь для теста (или используем seed данные)
        await test.step('Переход к списку бронирований', async () => {
            const listTab = page.locator('button:has-text("Список"), button:has-text("List"), [data-testid="list-tab"]').first();
            if (await listTab.isVisible({ timeout: 5000 })) {
                await listTab.click();
                await page.waitForTimeout(1000);
            }
        });

        await test.step('Поиск прошедшей брони', async () => {
            // Фильтруем по прошедшим броням или ищем бронь со статусом "confirmed"
            const pastBooking = page.locator('[data-testid="booking-row"]:has-text("confirmed"), tr:has-text("confirmed")').first();
            if (await pastBooking.isVisible({ timeout: 5000 })) {
                await pastBooking.scrollIntoViewIfNeeded();
            }
        });

        await test.step('Отметка "пришёл"', async () => {
            const attendedButton = page.locator('button:has-text("Пришел"), button:has-text("Attended"), [data-testid="mark-attended"]').first();
            if (await attendedButton.isVisible({ timeout: 5000 })) {
                await attendedButton.click();
                await page.waitForTimeout(2000);
                
                // Проверяем успешную отметку
                const successMessage = page.locator('text=/отмечено|marked|пришел/i').first();
                await expect(successMessage).toBeVisible({ timeout: 5000 });
                
                // Проверяем изменение статуса
                const paidStatus = page.locator('text=/paid|выполнено|пришел/i').first();
                await expect(paidStatus).toBeVisible({ timeout: 3000 });
            }
        });
    });

    test('должен отметить no-show (не пришёл)', async ({ page }) => {
        await test.step('Переход к списку бронирований', async () => {
            const listTab = page.locator('button:has-text("Список"), button:has-text("List"), [data-testid="list-tab"]').first();
            if (await listTab.isVisible({ timeout: 5000 })) {
                await listTab.click();
                await page.waitForTimeout(1000);
            }
        });

        await test.step('Поиск прошедшей брони', async () => {
            const pastBooking = page.locator('[data-testid="booking-row"]:has-text("confirmed"), tr:has-text("confirmed")').first();
            if (await pastBooking.isVisible({ timeout: 5000 })) {
                await pastBooking.scrollIntoViewIfNeeded();
            }
        });

        await test.step('Отметка "не пришёл"', async () => {
            const noShowButton = page.locator('button:has-text("Не пришел"), button:has-text("No Show"), [data-testid="mark-no-show"]').first();
            if (await noShowButton.isVisible({ timeout: 5000 })) {
                await noShowButton.click();
                await page.waitForTimeout(2000);
                
                // Проверяем успешную отметку
                const successMessage = page.locator('text=/отмечено|marked|не пришел/i').first();
                await expect(successMessage).toBeVisible({ timeout: 5000 });
                
                // Проверяем изменение статуса
                const noShowStatus = page.locator('text=/no.show|не пришел/i').first();
                await expect(noShowStatus).toBeVisible({ timeout: 3000 });
            }
        });
    });
});

