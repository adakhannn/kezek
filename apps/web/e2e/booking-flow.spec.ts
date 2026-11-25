/**
 * E2E тест: Полный цикл бронирования
 * Сценарий: филиал → день → мастер → услуги → время → подтверждение → страница брони.
 */

import { test, expect } from './fixtures';

import { signInWithEmailSeed } from './authHelpers';
import { businessDate, completeGuestBooking, expectBookingReceipt, walkPublicBookingToSlots } from './flows';
import { readRequiredEnv, skipIfMissingE2EEnv } from './testEnv';

skipIfMissingE2EEnv('booking-flow.spec.ts', ['E2E_TEST_BUSINESS_SLUG', 'E2E_TEST_CLIENT_EMAIL']);

test.describe('Полный цикл бронирования', () => {
    test('страница бизнеса ведёт в поток записи', async ({ page }) => {
        const slug = readRequiredEnv('E2E_TEST_BUSINESS_SLUG');
        await page.goto(`/b/${slug}`);

        await expect(page.getByRole('heading', { name: 'E2E Салон' }).first()).toBeVisible();
        await expect(page.getByTestId('services-section')).toContainText('Стрижка');

        await page.getByRole('link', { name: 'Записаться' }).first().click();
        await expect(page).toHaveURL(new RegExp(`/b/${slug}/booking`), { timeout: 30_000 });
        await expect(page.getByTestId('branch-card').first()).toBeVisible();
    });

    test('должен пройти полный цикл бронирования (вошедший клиент)', async ({ page }) => {
        await signInWithEmailSeed(page, readRequiredEnv('E2E_TEST_CLIENT_EMAIL'));
        const slot = await walkPublicBookingToSlots(page, {
            slug: readRequiredEnv('E2E_TEST_BUSINESS_SLUG'),
            day: businessDate(1),
        });
        await slot.click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toContainText('Стрижка');
        await dialog.getByRole('button', { name: 'Подтвердить запись' }).click();

        await expectBookingReceipt(page);
        await expect(page.locator('body')).toContainText('Стрижка');
        await expect(page.locator('body')).toContainText('E2E Мастер');
    });

    test('должен пройти полный цикл бронирования с гостем (без регистрации)', async ({ page }) => {
        const slot = await walkPublicBookingToSlots(page, {
            slug: readRequiredEnv('E2E_TEST_BUSINESS_SLUG'),
            day: businessDate(1),
        });
        await slot.click();

        await completeGuestBooking(page, 'Гость E2E', '+996555000001');

        await expectBookingReceipt(page);
        await expect(page.locator('body')).toContainText('Стрижка');
    });

    test('комплекс услуг: выбор нескольких услуг → слот → гостевой визит → успех', async ({ page }) => {
        const slot = await walkPublicBookingToSlots(page, {
            slug: readRequiredEnv('E2E_TEST_BUSINESS_SLUG'),
            day: businessDate(1),
            services: ['Стрижка', 'Укладка'],
        });
        // Two 30/60-minute services are booked as one visit of their total length.
        await expect(slot).toContainText(/1 ч/);
        await slot.click();

        await completeGuestBooking(page, 'E2E Комплекс Услуг', '+996555000002');

        await expectBookingReceipt(page);
        await expect(page.locator('body')).toContainText(/Всего: \d+ мин/);
    });

    test('комплекс услуг: бронь вошедшего клиента отображается в кабинете', async ({ page }) => {
        await signInWithEmailSeed(page, readRequiredEnv('E2E_TEST_CLIENT_EMAIL'));
        const slot = await walkPublicBookingToSlots(page, {
            slug: readRequiredEnv('E2E_TEST_BUSINESS_SLUG'),
            day: businessDate(2),
            services: ['Стрижка', 'Укладка'],
        });
        await slot.click();
        await page.getByRole('dialog').getByRole('button', { name: 'Подтвердить запись' }).click();
        const bookingId = await expectBookingReceipt(page);

        await page.goto('/cabinet');
        const card = page.locator(`a[href*="${bookingId}"]`).first();
        await expect(card).toBeVisible({ timeout: 15_000 });
    });
});
