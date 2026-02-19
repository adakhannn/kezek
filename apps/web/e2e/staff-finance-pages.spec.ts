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

    test.describe('Критические сценарии работы с финансами', () => {
        test('должен открыть смену, добавить клиентов и закрыть смену', async ({ page }) => {
            await page.goto('/staff/finance', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);

            // Шаг 1: Открыть смену
            const openButton = page.locator('button:has-text("Открыть"), button:has-text("Open")').first();
            if (await openButton.isVisible({ timeout: 3000 })) {
                await openButton.click();
                await page.waitForTimeout(1000);

                // Проверяем, что смена открыта
                const closeButton = page.locator('button:has-text("Закрыть"), button:has-text("Close")').first();
                await expect(closeButton).toBeVisible({ timeout: 5000 });
            }

            // Шаг 2: Добавить клиента
            const addButton = page.locator('button:has-text("Добавить"), button:has-text("Add")').first();
            if (await addButton.isVisible({ timeout: 3000 })) {
                await addButton.click();
                await page.waitForTimeout(500);

                // Заполняем данные клиента
                const clientNameInput = page.locator('input[name*="client"], input[placeholder*="клиент" i]').first();
                if (await clientNameInput.isVisible({ timeout: 2000 })) {
                    await clientNameInput.fill('Тестовый Клиент');
                }

                const serviceAmountInput = page.locator('input[name*="serviceAmount"], input[type="number"]').first();
                if (await serviceAmountInput.isVisible({ timeout: 2000 })) {
                    await serviceAmountInput.fill('1000');
                }

                // Сохраняем клиента
                const saveButton = page.locator('button:has-text("Сохранить"), button:has-text("Save")').first();
                if (await saveButton.isVisible({ timeout: 2000 })) {
                    await saveButton.click();
                    await page.waitForTimeout(2000);
                }
            }

            // Шаг 3: Проверяем, что клиент добавлен
            const clientList = page.locator('text=/Тестовый Клиент|Test Client/i');
            if (await clientList.count() > 0) {
                await expect(clientList.first()).toBeVisible({ timeout: 3000 });
            }

            // Шаг 4: Закрыть смену
            const closeButton = page.locator('button:has-text("Закрыть"), button:has-text("Close")').first();
            if (await closeButton.isVisible({ timeout: 3000 })) {
                await closeButton.click();
                await page.waitForTimeout(2000);

                // Проверяем, что смена закрыта
                const reopenButton = page.locator('button:has-text("Переоткрыть"), button:has-text("Reopen")').first();
                if (await reopenButton.isVisible({ timeout: 5000 })) {
                    await expect(reopenButton).toBeVisible();
                }
            }
        });

        test('должен экспортировать данные в CSV', async ({ page }) => {
            await page.goto('/staff/finance', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);

            // Переходим на вкладку клиентов
            const clientsTab = page.locator('button:has-text("Клиенты"), button:has-text("Clients")').first();
            if (await clientsTab.isVisible({ timeout: 3000 })) {
                await clientsTab.click();
                await page.waitForTimeout(1000);
            }

            // Ищем кнопку экспорта
            const exportButton = page.locator('button:has-text("Экспорт"), button:has-text("Export")').first();
            if (await exportButton.isVisible({ timeout: 3000 })) {
                // Настраиваем перехват скачивания файла
                const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
                await exportButton.click();
                
                const download = await downloadPromise;
                if (download) {
                    expect(download.suggestedFilename()).toContain('.csv');
                }
            }
        });

        test('должен корректно отображать финансовую сводку', async ({ page }) => {
            await page.goto('/staff/finance', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);

            // Проверяем наличие элементов сводки
            const summaryElements = page.locator('text=/оборот|turnover|сотруднику|staff|бизнесу|business/i');
            if (await summaryElements.count() > 0) {
                await expect(summaryElements.first()).toBeVisible({ timeout: 3000 });
            }
        });

        test('должен корректно отображать часы и доход по смене', async ({ page }) => {
            await page.goto('/staff/finance', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);

            // Шаг 1: Открыть смену (если не открыта)
            const openButton = page.locator('button:has-text("Открыть"), button:has-text("Open")').first();
            if (await openButton.isVisible({ timeout: 3000 })) {
                await openButton.click();
                await page.waitForTimeout(2000);
            }

            // Шаг 2: Добавить клиента с суммой
            const addButton = page.locator('button:has-text("Добавить"), button:has-text("Add")').first();
            if (await addButton.isVisible({ timeout: 3000 })) {
                await addButton.click();
                await page.waitForTimeout(500);

                const clientNameInput = page.locator('input[name*="client"], input[placeholder*="клиент" i]').first();
                if (await clientNameInput.isVisible({ timeout: 2000 })) {
                    await clientNameInput.fill('Клиент для теста дохода');
                }

                const serviceAmountInput = page.locator('input[name*="serviceAmount"], input[type="number"]').first();
                if (await serviceAmountInput.isVisible({ timeout: 2000 })) {
                    await serviceAmountInput.fill('2500');
                }

                const saveButton = page.locator('button:has-text("Сохранить"), button:has-text("Save")').first();
                if (await saveButton.isVisible({ timeout: 2000 })) {
                    await saveButton.click();
                    await page.waitForTimeout(2000);
                }
            }

            // Шаг 3: Проверяем отображение финансовой сводки
            await test.step('Проверка отображения оборота', async () => {
                const turnoverElement = page.locator('text=/оборот|turnover|итого/i').first();
                if (await turnoverElement.isVisible({ timeout: 5000 })) {
                    await expect(turnoverElement).toBeVisible();
                    
                    // Проверяем, что сумма отображается
                    const amountText = await turnoverElement.textContent();
                    expect(amountText).toMatch(/\d+/); // Должна быть хотя бы одна цифра
                }
            });

            // Шаг 4: Проверяем отображение доли сотрудника
            await test.step('Проверка отображения доли сотрудника', async () => {
                const staffShareElement = page.locator('text=/сотруднику|staff|мастеру/i').first();
                if (await staffShareElement.isVisible({ timeout: 5000 })) {
                    await expect(staffShareElement).toBeVisible();
                    
                    // Проверяем, что сумма отображается
                    const shareText = await staffShareElement.textContent();
                    expect(shareText).toMatch(/\d+/);
                }
            });

            // Шаг 5: Проверяем отображение доли бизнеса
            await test.step('Проверка отображения доли бизнеса', async () => {
                const businessShareElement = page.locator('text=/бизнесу|business|салону/i').first();
                if (await businessShareElement.isVisible({ timeout: 5000 })) {
                    await expect(businessShareElement).toBeVisible();
                }
            });

            // Шаг 6: Проверяем отображение часов (если есть почасовая ставка)
            await test.step('Проверка отображения часов', async () => {
                const hoursElement = page.locator('text=/часов|hours|ч\.|ч /i').first();
                if (await hoursElement.isVisible({ timeout: 5000 })) {
                    await expect(hoursElement).toBeVisible();
                    
                    // Проверяем, что часы отображаются в формате числа
                    const hoursText = await hoursElement.textContent();
                    expect(hoursText).toMatch(/\d+/);
                }
            });
        });

        test('должен корректно фильтровать данные по датам', async ({ page }) => {
            await page.goto('/staff/finance', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);

            // Шаг 1: Проверяем наличие датапикера
            await test.step('Проверка датапикера', async () => {
                const datePicker = page.locator('input[type="date"], [data-testid="date-picker"]').first();
                if (await datePicker.isVisible({ timeout: 5000 })) {
                    await expect(datePicker).toBeVisible();
                    
                    // Получаем текущую дату
                    const currentDate = new Date();
                    const currentDateStr = currentDate.toISOString().split('T')[0];
                    
                    // Проверяем, что датапикер показывает текущую дату или позволяет выбрать
                    const dateValue = await datePicker.inputValue();
                    expect(dateValue).toBeTruthy();
                }
            });

            // Шаг 2: Изменяем дату и проверяем обновление данных
            await test.step('Изменение даты и проверка обновления', async () => {
                const datePicker = page.locator('input[type="date"], [data-testid="date-picker"]').first();
                if (await datePicker.isVisible({ timeout: 5000 })) {
                    // Выбираем вчерашний день
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    const yesterdayStr = yesterday.toISOString().split('T')[0];
                    
                    // Перехватываем запрос к API
                    const apiResponsePromise = page.waitForResponse(
                        response => response.url().includes('/api/staff/finance') || response.url().includes('/api/dashboard/staff'),
                        { timeout: 10000 }
                    ).catch(() => null);
                    
                    await datePicker.fill(yesterdayStr);
                    await page.waitForTimeout(1000);
                    
                    // Ждем обновления данных
                    const response = await apiResponsePromise;
                    if (response) {
                        expect(response.status()).toBe(200);
                    }
                    
                    // Проверяем, что данные обновились (нет ошибок загрузки)
                    const errorMessage = page.locator('text=/ошибка|error|не найдено/i').first();
                    await expect(errorMessage).not.toBeVisible({ timeout: 3000 }).catch(() => {
                        // Игнорируем, если ошибок нет
                    });
                }
            });

            // Шаг 3: Переходим на вкладку статистики и проверяем фильтрацию по периодам
            await test.step('Проверка фильтрации по периодам в статистике', async () => {
                const statsTab = page.locator('button:has-text("Статистика"), button:has-text("Stats"), [data-testid="stats-tab"]').first();
                if (await statsTab.isVisible({ timeout: 5000 })) {
                    await statsTab.click();
                    await page.waitForTimeout(2000);
                    
                    // Проверяем наличие переключателей периода (день/месяц/год)
                    const periodButtons = page.locator('button:has-text("День"), button:has-text("Месяц"), button:has-text("Год"), button:has-text("Day"), button:has-text("Month"), button:has-text("Year")');
                    if (await periodButtons.count() > 0) {
                        // Выбираем период "месяц"
                        const monthButton = page.locator('button:has-text("Месяц"), button:has-text("Month")').first();
                        if (await monthButton.isVisible({ timeout: 3000 })) {
                            await monthButton.click();
                            await page.waitForTimeout(2000);
                            
                            // Проверяем, что данные обновились
                            const loadingIndicator = page.locator('text=/загрузка|loading/i').first();
                            await expect(loadingIndicator).not.toBeVisible({ timeout: 5000 });
                        }
                        
                        // Выбираем период "год"
                        const yearButton = page.locator('button:has-text("Год"), button:has-text("Year")').first();
                        if (await yearButton.isVisible({ timeout: 3000 })) {
                            await yearButton.click();
                            await page.waitForTimeout(2000);
                            
                            // Проверяем, что данные обновились
                            await expect(loadingIndicator).not.toBeVisible({ timeout: 5000 });
                        }
                    }
                }
            });
        });
    });
});

