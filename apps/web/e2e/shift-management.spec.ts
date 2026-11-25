/**
 * E2E тест: Управление сменой
 * Сценарий: открытие смены → добавление клиентов → закрытие смены (кабинет сотрудника /staff/finance).
 */

import { test, expect } from './fixtures';

import { signInWithPassword } from './authHelpers';
import { addShiftClient, ensureShiftOpen } from './flows';
import { readRequiredEnv, skipIfMissingE2EEnv } from './testEnv';

skipIfMissingE2EEnv('shift-management.spec.ts', ['E2E_TEST_STAFF_EMAIL', 'E2E_TEST_STAFF_PASSWORD']);

test.describe('Управление сменой сотрудника', () => {
    test.beforeEach(async ({ page }) => {
        const staffEmail = readRequiredEnv('E2E_TEST_STAFF_EMAIL');
        const staffPassword = readRequiredEnv('E2E_TEST_STAFF_PASSWORD');
        await signInWithPassword(page, staffEmail, staffPassword);
    });

    test('должен открыть смену, добавить клиентов и закрыть смену', async ({ page }) => {
        await test.step('Открытие смены', async () => {
            await page.goto('/staff/finance');
            await ensureShiftOpen(page);
        });

        await test.step('Добавление клиентов в смену', async () => {
            await addShiftClient(page, { name: 'Клиент 1', service: 'Стрижка', amount: 1000 });
            await addShiftClient(page, { name: 'Клиент 2', service: 'Окрашивание', amount: 2000 });
        });

        await test.step('Закрытие смены', async () => {
            await page.getByRole('button', { name: /^Текущая смена/ }).first().click();
            await page.getByRole('button', { name: 'Закрыть смену' }).click();
            // The staff page shows the closed status; reopening is the manager's action.
            await expect(page.getByText('Закрыта', { exact: true })).toBeVisible({ timeout: 20_000 });
            await expect(page.getByRole('button', { name: 'Закрыть смену' })).toHaveCount(0);

            // The closed shift keeps the clients' turnover in its summary.
            await expect(page.getByText('Сводка по смене')).toBeVisible();
            await expect(page.getByText('Итого сотруднику за смену')).toBeVisible();
            await expect(page.getByText('Итого бизнесу за смену')).toBeVisible();
        });
    });
});
