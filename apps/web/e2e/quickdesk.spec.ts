/**
 * E2E тест: QuickDesk и список броней в кабинете бизнеса.
 * Сценарии:
 * - создание брони в QuickDesk (новый и существующий клиент, несколько подряд);
 * - подтверждение, отмена, отметка «пришёл» / «не пришёл» в списке;
 * - QuickDesk не предлагает время без мастера и прошедшие даты.
 *
 * Брони фикстуры (scripts/e2e-seed.mjs) у мастера «E2E Мульти»: вчерашние «E2E Пришёл» и
 * «E2E Неявка», завтрашние «E2E Ожидает» (hold) и «E2E Отмена». QuickDesk бронирует «E2E Мастер».
 */

import { test, expect, type Page, type StorageState } from './fixtures';

import { applyStorageStateCookies, createStorageStateForEmailSeed } from './authHelpers';
import { businessDate, openBookingsTab } from './flows';
import { readRequiredEnv, skipIfMissingE2EEnv } from './testEnv';

skipIfMissingE2EEnv('quickdesk.spec.ts', ['E2E_TEST_MANAGER_EMAIL', 'E2E_TEST_CLIENT_SEARCH']);

/** Branch, tomorrow, master and service in QuickDesk; returns the time select. */
async function fillDeskVisit(page: Page, service = 'Стрижка') {
    await page.getByLabel('Филиал', { exact: true }).selectOption({ label: 'E2E Филиал Центр' });
    await page.getByRole('button', { name: 'Завтра', exact: true }).click();
    await expect(page.getByLabel('Дата', { exact: true })).toHaveValue(businessDate(1));
    await page.getByLabel('Мастер', { exact: true }).selectOption({ label: 'E2E Мастер' });
    const serviceSelect = page.getByLabel('Услуга', { exact: true });
    await expect(serviceSelect.locator('option', { hasText: service })).toHaveCount(1);
    await serviceSelect.selectOption({ label: `${service} · 30 мин` });
    const time = page.getByLabel('Время', { exact: true });
    await expect(time).toBeEnabled({ timeout: 15_000 });
    return time;
}

/** Opens the list tab and finds the row of a fixture booking by client name. */
async function bookingRow(page: Page, clientName: string) {
    await openBookingsTab(page, 'История и поиск');
    await page.getByLabel('Поиск', { exact: true }).fill(clientName);
    const row = page.locator('tr', { hasText: clientName });
    await expect(row).toHaveCount(1, { timeout: 15_000 });
    return row;
}

async function confirmDialog(page: Page) {
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Подтвердить', exact: true }).click();
}

test.describe('QuickDesk - управление бронированиями', () => {
    let managerAuthState: StorageState | null = null;

    test.beforeAll(async ({ browser }) => {
        managerAuthState = await createStorageStateForEmailSeed(browser, readRequiredEnv('E2E_TEST_MANAGER_EMAIL'));
    });

    test.beforeEach(async ({ page }) => {
        await applyStorageStateCookies(page, managerAuthState);
    });

    test('должен создать бронирование через QuickDesk (новый клиент)', async ({ page }) => {
        await openBookingsTab(page, 'Сегодня (QuickDesk)');
        const time = await fillDeskVisit(page);
        await time.selectOption({ index: 1 });

        await page.getByRole('button', { name: /Новый клиент/ }).click();
        const clientName = `Тестовый Клиент QuickDesk ${Date.now()}`;
        await page.getByPlaceholder('Имя').fill(clientName);
        await page.getByPlaceholder('Телефон').fill('+996555123456');

        const create = page.getByRole('button', { name: 'Создать запись' });
        await expect(create).toBeEnabled();
        await create.click();
        await expect(page.getByText(/Создана запись #[0-9a-f]{8}/)).toBeVisible();

        const row = await bookingRow(page, clientName);
        await expect(row).toContainText('E2E Мастер');
    });

    test('должен создать бронирование для существующего клиента', async ({ page }) => {
        await openBookingsTab(page, 'Сегодня (QuickDesk)');
        const time = await fillDeskVisit(page, 'Укладка');
        await time.selectOption({ index: 1 });

        await page.getByRole('button', { name: /Существующий/ }).click();
        await page.getByPlaceholder(/Поиск: \+996/).fill(readRequiredEnv('E2E_TEST_CLIENT_SEARCH'));
        const found = page.getByRole('button', { name: /E2E Клиент/ });
        await expect(found).toBeVisible();
        await found.click();
        await expect(page.getByText('Клиент найден')).toBeVisible();

        await page.getByRole('button', { name: 'Создать запись' }).click();
        await expect(page.getByText(/Создана запись #[0-9a-f]{8}/)).toBeVisible();
    });

    test('должен корректно обработать быстрое создание нескольких бронирований', async ({ page }) => {
        await openBookingsTab(page, 'Сегодня (QuickDesk)');
        const run = Date.now();
        for (const name of [`Быстрое бронирование 1 ${run}`, `Быстрое бронирование 2 ${run}`]) {
            const time = await fillDeskVisit(page);
            // The first free time; after the first booking it is a later one.
            const first = await time.locator('option').nth(1).textContent();
            await time.selectOption({ index: 1 });
            await page.getByRole('button', { name: /Новый клиент/ }).click();
            await page.getByPlaceholder('Имя').fill(name);
            await page.getByPlaceholder('Телефон').fill('+996555111111');
            await page.getByRole('button', { name: 'Создать запись' }).click();
            await expect(page.getByText(/Создана запись #[0-9a-f]{8}/).last()).toBeVisible();
            expect(first).toMatch(/\d{2}:\d{2}–\d{2}:\d{2}/);
        }

        await openBookingsTab(page, 'История и поиск');
        await page.getByLabel('Поиск', { exact: true }).fill(String(run));
        await expect(page.locator('tr', { hasText: `Быстрое бронирование 1 ${run}` })).toHaveCount(1);
        await expect(page.locator('tr', { hasText: `Быстрое бронирование 2 ${run}` })).toHaveCount(1);
    });

    test('без мастера услуга и время недоступны', async ({ page }) => {
        await openBookingsTab(page, 'Сегодня (QuickDesk)');
        await page.getByLabel('Филиал', { exact: true }).selectOption({ label: 'E2E Филиал Центр' });

        await expect(page.getByLabel('Услуга', { exact: true })).toBeDisabled();
        await expect(page.getByLabel('Время', { exact: true })).toBeDisabled();
        await expect(page.getByText('Выбери филиал, услугу и мастера')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Создать запись' })).toBeDisabled();
    });

    test('прошедшая дата не выбирается', async ({ page }) => {
        await openBookingsTab(page, 'Сегодня (QuickDesk)');
        const date = page.getByLabel('Дата', { exact: true });
        await expect(date).toHaveAttribute('min', businessDate(0));
        await expect(date).toHaveValue(businessDate(0));
    });

    test('должен подтвердить бронь в статусе hold', async ({ page }) => {
        const row = await bookingRow(page, 'E2E Ожидает');
        await expect(row).toContainText('В ожидании');
        await row.getByRole('button', { name: 'Подтвердить', exact: true }).click();
        await confirmDialog(page);
        await expect(page.getByText('Запись подтверждена')).toBeVisible();
        await expect(row).toContainText('Подтверждено');
    });

    test('должен отменить бронирование', async ({ page }) => {
        const row = await bookingRow(page, 'E2E Отмена');
        await row.getByRole('button', { name: 'Отменить', exact: true }).click();
        await confirmDialog(page);
        await expect(page.getByText('Запись отменена')).toBeVisible();
        // Cancelled bookings leave the default "active" list.
        await page.locator('select', { has: page.locator('option[value="no_show"]') }).selectOption('cancelled');
        await expect(page.locator('tr', { hasText: 'E2E Отмена' })).toContainText('Отменено');
    });

    test('должен отметить посещение (пришёл)', async ({ page }) => {
        const row = await bookingRow(page, 'E2E Пришёл');
        await row.getByRole('button', { name: 'Пришел', exact: true }).click();
        await confirmDialog(page);
        await expect(row).toContainText('пришел');
    });

    test('должен отметить no-show (не пришёл)', async ({ page }) => {
        const row = await bookingRow(page, 'E2E Неявка');
        await row.getByRole('button', { name: 'Не пришел', exact: true }).click();
        await confirmDialog(page);
        await page.locator('select', { has: page.locator('option[value="no_show"]') }).selectOption('no_show');
        await expect(page.locator('tr', { hasText: 'E2E Неявка' })).toContainText(/не приш[её]л/i);
    });
});
