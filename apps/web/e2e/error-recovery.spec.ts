/**
 * E2E: сценарии восстановления после ошибок.
 *
 * Покрывает:
 * - сетевую ошибку /api/staff/finance и повторную загрузку;
 * - сбой загрузки слотов QuickDesk (/dashboard/bookings) и повтор;
 * - ошибку при создании брони в публичном потоке с показом ошибки и повтором.
 */

import { test, expect } from './fixtures';

import { signInWithEmailSeed } from './authHelpers';
import { businessDate, expectBookingReceipt, openBookingsTab, walkPublicBookingToSlots } from './flows';
import { readRequiredEnv, skipIfMissingE2EEnv } from './testEnv';

skipIfMissingE2EEnv('error-recovery.spec.ts', [
    'E2E_TEST_MANAGER_EMAIL',
    'E2E_TEST_STAFF_EMAIL',
    'E2E_TEST_CLIENT_EMAIL',
    'E2E_TEST_BUSINESS_SLUG',
]);

test.describe('Восстановление после ошибок', () => {
    test('страница /staff/finance восстанавливается после сетевой ошибки', async ({ page }) => {
        await signInWithEmailSeed(page, readRequiredEnv('E2E_TEST_STAFF_EMAIL'));
        let failing = true;
        await page.route('**/api/staff/finance**', async (route) => {
            if (failing) await route.abort('failed');
            else await route.continue();
        });

        await test.step('Первый заход: сетевая ошибка показана, страница не упала', async () => {
            await page.goto('/staff/finance');
            await expect(page.getByText('Ошибка загрузки данных')).toBeVisible({ timeout: 30_000 });
            await expect(page.getByRole('button', { name: 'Попробовать снова' })).toBeVisible();
        });

        await test.step('Повторная загрузка страницы восстанавливает данные', async () => {
            failing = false;
            await page.reload();
            await expect(page.getByText('Сводка по смене').or(page.getByText('Смена не открыта')).first()).toBeVisible({
                timeout: 30_000,
            });
            await expect(page.getByText('Ошибка загрузки данных')).toHaveCount(0);
        });
    });

    test('QuickDesk восстанавливается после сбоя загрузки слотов', async ({ page }) => {
        await signInWithEmailSeed(page, readRequiredEnv('E2E_TEST_MANAGER_EMAIL'));
        let failing = true;
        await page.route('**/rpc/get_free_slots_service_day_v2*', async (route) => {
            if (failing) await route.abort('timedout');
            else await route.continue();
        });

        await openBookingsTab(page, 'Сегодня (QuickDesk)');
        await page.getByLabel('Филиал', { exact: true }).selectOption({ label: 'E2E Филиал Центр' });
        await page.getByRole('button', { name: 'Завтра', exact: true }).click();
        await page.getByLabel('Мастер', { exact: true }).selectOption({ label: 'E2E Мастер' });
        await page.getByLabel('Услуга', { exact: true }).selectOption({ label: 'Стрижка · 30 мин' });

        await expect(page.getByText('Не удалось загрузить свободное время')).toBeVisible({ timeout: 20_000 });
        await expect(page.getByLabel('Время', { exact: true })).toBeDisabled();

        failing = false;
        await page.getByRole('button', { name: /Повторить|Попробовать/ }).first().click();
        await expect(page.getByLabel('Время', { exact: true })).toBeEnabled({ timeout: 20_000 });
        await expect(page.getByText(/\d+ свободных слотов/)).toBeVisible();
    });

    test('публичное бронирование показывает ошибку и позволяет повторить после неудачи', async ({ page }) => {
        await signInWithEmailSeed(page, readRequiredEnv('E2E_TEST_CLIENT_EMAIL'));
        let failedOnce = false;
        await page.route('**/api/quick-hold', async (route) => {
            if (!failedOnce) {
                failedOnce = true;
                await route.fulfill({
                    status: 400,
                    contentType: 'application/json',
                    body: JSON.stringify({ ok: false, error: 'validation', message: 'E2E simulated error' }),
                });
                return;
            }
            await route.continue();
        });

        const slot = await walkPublicBookingToSlots(page, {
            slug: readRequiredEnv('E2E_TEST_BUSINESS_SLUG'),
            day: businessDate(3),
        });

        await test.step('Первая попытка: ошибка показана, бронь не создана', async () => {
            await slot.click();
            await page.getByRole('dialog').getByRole('button', { name: 'Подтвердить запись' }).click();
            await expect(page.getByText('E2E simulated error').first()).toBeVisible();
            await expect(page).not.toHaveURL(/\/booking\/[0-9a-f-]{36}/);
        });

        await test.step('Повторная попытка создаёт бронь', async () => {
            const confirm = page.getByRole('dialog').getByRole('button', { name: 'Подтвердить запись' });
            if (!(await confirm.isVisible())) await slot.click();
            await page.getByRole('dialog').getByRole('button', { name: 'Подтвердить запись' }).click();
            await expectBookingReceipt(page);
        });
    });
});
