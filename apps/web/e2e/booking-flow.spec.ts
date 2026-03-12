/**
 * E2E тест: Полный цикл бронирования
 * Сценарий: выбор филиала → мастера → услуги → времени → подтверждение
 */

import { test, expect } from '@playwright/test';

// Фиксированная дата для E2E, чтобы не зависеть от локальной TZ машины.
// Можно переопределить через E2E_TEST_TODAY=YYYY-MM-DD.
function getTodayDateString(): string {
    const fromEnv = process.env.E2E_TEST_TODAY;
    if (fromEnv && /^\d{4}-\d{2}-\d{2}$/.test(fromEnv)) {
        return fromEnv;
    }
    // По умолчанию считаем "сегодня" в Asia/Bishkek через UTC, чтобы избежать сдвигов.
    // Берём только компонент YYYY-MM-DD из локальной даты без toISOString().
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getTomorrowDateString(): string {
    const today = getTodayDateString();
    const [y, m, d] = today.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    date.setUTCDate(date.getUTCDate() + 1);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

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
                // Выбираем завтрашний день (первый доступный), стабилизированный по дате
                const tomorrowStr = getTomorrowDateString();
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
                await dateInput.fill(getTomorrowDateString());
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

    test('комплекс услуг: выбор нескольких услуг → слот → гостевой визит → успех', async ({
        page,
    }) => {
        const businessSlug = process.env.E2E_TEST_BUSINESS_SLUG || 'test-business';
        const tomorrowStr = getTomorrowDateString();

        await page.goto(`/b/${businessSlug}/booking`);
        await page.waitForLoadState('networkidle');

        await test.step('Шаг 1: Выбор филиала', async () => {
            const branchCard = page.locator('[data-testid="branch-card"]').first();
            if (await branchCard.isVisible({ timeout: 5000 })) {
                await branchCard.click();
            } else {
                const branchSelect = page.locator('[data-testid="branch-select"]').first();
                if (await branchSelect.isVisible({ timeout: 3000 })) {
                    await branchSelect.click();
                    await page.locator('[data-testid="branch-option"]').first().click();
                }
            }
            await page.locator('button:has-text("Далее")').first().click();
            await page.waitForTimeout(500);
        });

        await test.step('Шаг 2: Выбор дня', async () => {
            const datePicker = page.locator('[data-testid="date-picker"]').first();
            await expect(datePicker).toBeVisible({ timeout: 5000 });
            const tomorrowDate = page.locator(`button[data-date="${tomorrowStr}"]`).first();
            if (!(await tomorrowDate.isVisible({ timeout: 2000 }))) {
                const nextMonthBtn = datePicker.locator('button:has-text("›")').first();
                if (await nextMonthBtn.isVisible({ timeout: 1000 })) {
                    await nextMonthBtn.click();
                    await page.waitForTimeout(300);
                }
            }
            await page.locator(`button[data-date="${tomorrowStr}"]`).first().click();
            await page.waitForTimeout(300);
            await page.locator('button:has-text("Далее")').first().click();
            await page.waitForTimeout(500);
        });

        await test.step('Шаг 3: Выбор мастера', async () => {
            const masterCard = page.locator('[data-testid="master-card"]').first();
            await expect(masterCard).toBeVisible({ timeout: 5000 });
            await masterCard.click();
            await page.waitForTimeout(300);
            await page.locator('button:has-text("Далее")').first().click();
            await page.waitForTimeout(500);
        });

        await test.step('Шаг 4: Выбор нескольких услуг', async () => {
            const serviceCards = page.locator('[data-testid="service-card"]');
            await expect(serviceCards.first()).toBeVisible({ timeout: 5000 });
            const count = await serviceCards.count();
            if (count < 2) {
                test.skip(true, 'Нужно минимум 2 услуги у мастера для теста комплекса');
                return;
            }
            await serviceCards.nth(0).click();
            await page.waitForTimeout(200);
            await serviceCards.nth(1).click();
            await page.waitForTimeout(300);
            await page.locator('button:has-text("Далее")').first().click();
            await page.waitForTimeout(500);
        });

        await test.step('Шаг 5: Выбор времени', async () => {
            await page.waitForSelector('[data-testid="time-slot"]', { timeout: 15000 });
            const firstSlot = page.locator('[data-testid="time-slot"]').first();
            await expect(firstSlot).toBeVisible();
            await firstSlot.click();
            await page.waitForTimeout(500);
        });

        await test.step('Гостевое бронирование', async () => {
            const guestButton = page.locator(
                'button:has-text("Запись без регистрации"), button:has-text("без регистрации")'
            ).first();
            await expect(guestButton).toBeVisible({ timeout: 5000 });
            await guestButton.click();
            await page.waitForTimeout(500);
            const nameInput = page.locator(
                'input[placeholder*="имя" i], input[name="name"], input[name="client_name"]'
            ).first();
            await expect(nameInput).toBeVisible({ timeout: 3000 });
            await nameInput.fill('E2E Комплекс Услуг');
            const phoneInput = page.locator('input[type="tel"], input[placeholder*="996"]').first();
            await expect(phoneInput).toBeVisible({ timeout: 2000 });
            await phoneInput.fill('+996555000002');
            const submitBtn = page.locator(
                'button:has-text("Забронировать"), button:has-text("Создать")'
            ).first();
            await submitBtn.click();
        });

        await test.step('Проверка успешного создания бронирования', async () => {
            await page.waitForURL(/\/booking\/|success|cabinet/, { timeout: 15000 });
            const successMessage = page.locator(
                'text=/успешно|создана|подтверждено|бронирование|записан/i'
            ).first();
            await expect(successMessage).toBeVisible({ timeout: 10000 });
        });
    });

    test('комплекс услуг: выбор нескольких услуг → слот → бронь → отображение в кабинете (требует E2E_TEST_CLIENT_EMAIL)', async ({
        page,
    }) => {
        const clientEmail = process.env.E2E_TEST_CLIENT_EMAIL;
        if (!clientEmail) {
            test.skip(true, 'Проверка кабинета требует E2E_TEST_CLIENT_EMAIL');
            return;
        }

        const businessSlug = process.env.E2E_TEST_BUSINESS_SLUG || 'test-business';
        const tomorrowStr = getTomorrowDateString();

        await test.step('Вход в кабинет клиента', async () => {
            await page.goto('/auth/sign-in');
            await page.waitForLoadState('networkidle');
            const emailInput = page.locator('input[type="email"], input[name="email"]').first();
            if (!(await emailInput.isVisible({ timeout: 5000 }))) {
                test.skip(true, 'Страница входа недоступна');
                return;
            }
            await emailInput.fill(clientEmail);
            const submitBtn = page.locator('button:has-text("Отправить"), button[type="submit"]').first();
            await submitBtn.click();
            await page.waitForTimeout(3000);
        });

        await page.goto(`/b/${businessSlug}/booking`);
        await page.waitForLoadState('networkidle');

        await test.step('Шаг 1–3: Филиал, день, мастер', async () => {
            const branchCard = page.locator('[data-testid="branch-card"]').first();
            if (await branchCard.isVisible({ timeout: 5000 })) await branchCard.click();
            else {
                const branchSelect = page.locator('[data-testid="branch-select"]').first();
                if (await branchSelect.isVisible({ timeout: 3000 })) {
                    await branchSelect.click();
                    await page.locator('[data-testid="branch-option"]').first().click();
                }
            }
            await page.locator('button:has-text("Далее")').first().click();
            await page.waitForTimeout(500);

            const datePicker = page.locator('[data-testid="date-picker"]').first();
            await expect(datePicker).toBeVisible({ timeout: 5000 });
            const tomorrowBtn = page.locator(`button[data-date="${tomorrowStr}"]`).first();
            if (!(await tomorrowBtn.isVisible({ timeout: 2000 }))) {
                await datePicker.locator('button:has-text("›")').first().click();
                await page.waitForTimeout(300);
            }
            await page.locator(`button[data-date="${tomorrowStr}"]`).first().click();
            await page.waitForTimeout(300);
            await page.locator('button:has-text("Далее")').first().click();
            await page.waitForTimeout(500);

            const masterCard = page.locator('[data-testid="master-card"]').first();
            await expect(masterCard).toBeVisible({ timeout: 5000 });
            await masterCard.click();
            await page.waitForTimeout(300);
            await page.locator('button:has-text("Далее")').first().click();
            await page.waitForTimeout(500);
        });

        await test.step('Шаг 4: Выбор двух услуг', async () => {
            const serviceCards = page.locator('[data-testid="service-card"]');
            await expect(serviceCards.first()).toBeVisible({ timeout: 5000 });
            if ((await serviceCards.count()) < 2) {
                test.skip(true, 'Нужно минимум 2 услуги у мастера');
                return;
            }
            await serviceCards.nth(0).click();
            await page.waitForTimeout(200);
            await serviceCards.nth(1).click();
            await page.waitForTimeout(300);
            await page.locator('button:has-text("Далее")').first().click();
            await page.waitForTimeout(500);
        });

        await test.step('Шаг 5: Слот и подтверждение', async () => {
            await page.waitForSelector('[data-testid="time-slot"]', { timeout: 15000 });
            await page.locator('[data-testid="time-slot"]').first().click();
            await page.waitForTimeout(500);
            const confirmBtn = page.locator(
                'button:has-text("Подтвердить"), button:has-text("Забронировать")'
            ).first();
            await expect(confirmBtn).toBeVisible({ timeout: 5000 });
            await confirmBtn.click();
        });

        await test.step('Успех и переход в кабинет', async () => {
            await page.waitForURL(/\/booking\/|success|cabinet/, { timeout: 15000 });
            await page.goto('/cabinet');
            await page.waitForLoadState('networkidle');
        });

        await test.step('Проверка: в кабинете отображается состав визита (несколько услуг)', async () => {
            const multiServiceLabel = page.locator(
                'text=/Услуги в визите|Всего:.*мин|услуги в визите/i'
            ).first();
            await expect(multiServiceLabel).toBeVisible({ timeout: 10000 });
        });
    });
});

