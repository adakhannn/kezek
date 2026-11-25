/**
 * E2E тест: Акции филиала при бронировании
 *
 * Фикстура (scripts/e2e-seed.mjs) у филиала E2E_TEST_BRANCH_ID: активные «Скидка 20% на первый
 * визит» (first_visit_discount, 20%) и «Каждая 5-я услуга бесплатно» (free_after_n_visits, 5) и
 * выключенная «E2E Завершённая акция». Акция применяется при отметке посещения, поэтому в потоке
 * записи она показывается как «будет применена», а цена записи — цена услуги.
 */

import { test, expect } from './fixtures';

import { signInWithEmailSeed } from './authHelpers';
import { businessDate, completeGuestBooking, expectBookingReceipt, walkPublicBookingToSlots } from './flows';
import { readRequiredEnv, skipIfMissingE2EEnv } from './testEnv';

skipIfMissingE2EEnv('promotion-application.spec.ts', ['E2E_TEST_BUSINESS_SLUG', 'E2E_TEST_MANAGER_EMAIL', 'E2E_TEST_BRANCH_ID']);

const PROMO_ALERT = 'При оплате будет применена акция:';

test.describe('Применение промо при бронировании', () => {
    test('должен показать акцию в потоке записи и создать бронирование', async ({ page }) => {
        const slot = await walkPublicBookingToSlots(page, {
            slug: readRequiredEnv('E2E_TEST_BUSINESS_SLUG'),
            day: businessDate(1),
        });

        await expect(page.getByText(PROMO_ALERT)).toBeVisible();
        await expect(page.getByText(/Скидка 20%/).first()).toBeVisible();

        await slot.click();
        await completeGuestBooking(page, 'Клиент с промо', '+996555123457');
        await expectBookingReceipt(page);
    });

    test('должен отобразить информацию о промоакции на странице бизнеса', async ({ page }) => {
        await page.goto(`/b/${readRequiredEnv('E2E_TEST_BUSINESS_SLUG')}`);
        const section = page.getByTestId('promotions-section');
        await expect(section).toContainText('Скидка 20%');
        await expect(section).toContainText('Каждая 5-я услуга бесплатно');
        await expect(section).toContainText('E2E Филиал Центр');
    });

    test('должен проверить итоговую сумму с примененной промоакцией', async ({ page }) => {
        await walkPublicBookingToSlots(page, {
            slug: readRequiredEnv('E2E_TEST_BUSINESS_SLUG'),
            day: businessDate(1),
            services: ['Стрижка', 'Укладка'],
        });

        // The visit total is the services' price (500 + 700); the discount applies at payment.
        await expect(page.getByTestId('final-price')).toHaveText('60 мин, 1200 сом');
        await expect(page.getByText(PROMO_ALERT)).toBeVisible();
    });

    test('должен проверить статистику по промоакциям', async ({ page }) => {
        await signInWithEmailSeed(page, readRequiredEnv('E2E_TEST_MANAGER_EMAIL'));
        await page.goto(`/dashboard/branches/${readRequiredEnv('E2E_TEST_BRANCH_ID')}`);

        await expect(page.getByRole('heading', { name: 'Акции филиала' })).toBeVisible();
        const firstVisit = page.locator('div', { hasText: 'Скидка 20% на первый визит' }).last();
        await expect(firstVisit).toBeVisible();
        await expect(page.getByText(/Использовано: \d+ раз/).first()).toBeVisible();
        await expect(page.getByText('E2E Завершённая акция')).toBeVisible();
        await expect(page.getByText('Неактивна').first()).toBeVisible();
    });

    test('должен показать промо с процентной скидкой', async ({ page }) => {
        await page.goto(`/b/${readRequiredEnv('E2E_TEST_BUSINESS_SLUG')}/promotions`);
        await expect(page.getByText('Скидка 20% на первый визит').first()).toBeVisible();
        await expect(page.getByText(/20\s?%/).first()).toBeVisible();
    });

    test('должен показать промо типа "бесплатно"', async ({ page }) => {
        await page.goto(`/b/${readRequiredEnv('E2E_TEST_BUSINESS_SLUG')}/promotions`);
        await expect(page.getByText('Каждая 5-я услуга бесплатно').first()).toBeVisible();
    });

    test('должен не показывать выключенную (завершённую) акцию', async ({ page }) => {
        const slug = readRequiredEnv('E2E_TEST_BUSINESS_SLUG');
        await page.goto(`/b/${slug}`);
        await expect(page.getByTestId('promotions-section')).toContainText('Скидка 20%');
        await expect(page.getByText('E2E Завершённая акция')).toHaveCount(0);

        await page.goto(`/b/${slug}/promotions`);
        await expect(page.getByText('Каждая 5-я услуга бесплатно').first()).toBeVisible();
        await expect(page.getByText('E2E Завершённая акция')).toHaveCount(0);
    });
});
