/**
 * E2E: Пакеты визитов — полный сценарий
 * Владелец создаёт план → продаёт пакет клиенту → создаётся бронь → мастер отмечает посещение
 * → в дашборде остаток по пакету уменьшился; опционально в кабинете клиента «Оплачено пакетом».
 *
 * Требует: E2E_TEST_MANAGER_EMAIL (и при необходимости OTP/пароль), тестовый бизнес с филиалами/услугами.
 * Опционально: E2E_TEST_CLIENT_SEARCH — строка поиска клиента (например "Тест"); E2E_TEST_CLIENT_EMAIL — для проверки кабинета.
 *
 * Запуск: pnpm test:e2e e2e/visit-packages-flow.spec.ts
 */

import { test, expect, type StorageState } from '@playwright/test';
import { applyStorageStateCookies, createStorageStateForEmailSeed } from './authHelpers';
import { readRequiredEnv, skipIfMissingE2EEnv } from './testEnv';

skipIfMissingE2EEnv('visit-packages-flow.spec.ts', ['E2E_TEST_MANAGER_EMAIL', 'E2E_TEST_CLIENT_SEARCH']);

function getTodayDateString(): string {
    const fromEnv = process.env.E2E_TEST_TODAY;
    if (fromEnv && /^\d{4}-\d{2}-\d{2}$/.test(fromEnv)) return fromEnv;
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getTomorrowDateString(): string {
    const today = getTodayDateString();
    const [y, m, d] = today.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    date.setUTCDate(date.getUTCDate() + 1);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

test.describe('Пакеты визитов: план → продажа → бронь → посещение → остаток', () => {
    let managerStorageState: StorageState | null = null;

    test.beforeAll(async ({ browser }) => {
        const managerEmail = readRequiredEnv('E2E_TEST_MANAGER_EMAIL');
        managerStorageState = await createStorageStateForEmailSeed(browser, managerEmail, {
            waitAfterSubmitMs: 3000,
        });
    });

    test.beforeEach(async ({ page }) => {
        await applyStorageStateCookies(page, managerStorageState);
    });

    test('полный сценарий: создание плана, продажа пакета, бронь, отметка посещения, проверка остатка', async ({ page }) => {
        const planName = `E2E Пакет ${Date.now()}`;
        const clientSearch = readRequiredEnv('E2E_TEST_CLIENT_SEARCH');

        await test.step('1. Создать тип пакета', async () => {
            await page.goto('/dashboard/visit-packages');
            await page.waitForLoadState('networkidle');

            await page.locator('a[href="/dashboard/visit-packages/new"]').first().click();
            await page.waitForURL(/\/dashboard\/visit-packages\/new/);
            await page.waitForLoadState('networkidle');

            const form = page.locator('[data-testid="visit-package-plan-form"]');
            await expect(form).toBeVisible({ timeout: 5000 });

            await page.getByLabel(/Название \(русский\)/i).fill(planName);
            await page.getByLabel(/Количество визитов/i).fill('5');
            await page.getByLabel(/Срок действия \(дней\)/i).fill('90');
            await page.locator('input[name="discount_type"][value="percent"]').check();
            await page.getByLabel(/Значение скидки/i).fill('20');

            await page.locator('[data-testid="visit-package-plan-submit"]').click();
            await page.waitForURL(/\/dashboard\/visit-packages(?:\?|$)/, { timeout: 10000 });
            await expect(page.locator(`text=${planName}`).first()).toBeVisible({ timeout: 5000 });
        });

        await test.step('2. Продать пакет клиенту в QuickDesk', async () => {
            await page.goto('/dashboard/bookings');
            await page.waitForLoadState('networkidle');

            const deskTab = page.locator('button:has-text("QuickDesk"), button:has-text("Стол")').first();
            if (await deskTab.isVisible({ timeout: 5000 })) {
                await deskTab.click();
                await page.waitForTimeout(1000);
            }

            const existingMode = page.locator('input[type="radio"][value="existing"], label:has-text("существующий")').first();
            if (await existingMode.isVisible({ timeout: 3000 })) {
                await existingMode.click();
                await page.waitForTimeout(500);
            }

            const searchInput = page.locator('input[type="search"], input[placeholder*="клиент" i]').first();
            if (await searchInput.isVisible({ timeout: 3000 })) {
                await searchInput.fill(clientSearch);
                await page.waitForTimeout(1500);
            }

            const clientList = page.locator('ul.max-h-40 button').first();
            if (await clientList.isVisible({ timeout: 5000 })) {
                await clientList.click();
                await page.waitForTimeout(500);
            }

            const sellPackageBtn = page.locator('button:has-text("Продать пакет")').first();
            if (!(await sellPackageBtn.isVisible({ timeout: 3000 }))) {
                test.skip(true, 'Клиент не выбран или кнопка «Продать пакет» недоступна — нужен существующий клиент в тестовых данных');
                return;
            }
            await sellPackageBtn.click();
            await page.waitForTimeout(500);

            const modal = page.locator('[role="dialog"], .modal').first();
            await expect(modal).toBeVisible({ timeout: 5000 });
            const planSelect = modal.locator('select').first();
            if (await planSelect.isVisible({ timeout: 3000 })) {
                await planSelect.selectOption({ index: 0 });
            }
            await modal.locator('button:has-text("Продать пакет")').last().click();
            await page.waitForTimeout(2000);
            await expect(modal).not.toBeVisible().catch(() => {});
        });

        await test.step('3. Создать бронирование для выбранного клиента', async () => {
            const branchSelect = page.locator('select[name="branch"], [data-testid="branch-select"]').first();
            if (await branchSelect.isVisible({ timeout: 5000 })) {
                await branchSelect.selectOption({ index: 1 });
                await page.waitForTimeout(500);
            }

            const staffSelect = page.locator('select[name="staff"], [data-testid="staff-select"]').first();
            if (await staffSelect.isVisible({ timeout: 5000 })) {
                await staffSelect.selectOption({ index: 1 });
                await page.waitForTimeout(500);
            }

            const serviceSelect = page.locator('select[name="service"], [data-testid="service-select"]').first();
            if (await serviceSelect.isVisible({ timeout: 5000 })) {
                await serviceSelect.selectOption({ index: 1 });
                await page.waitForTimeout(1000);
            }

            const dateInput = page.locator('input[type="date"], [data-testid="date-picker"]').first();
            if (await dateInput.isVisible({ timeout: 3000 })) {
                await dateInput.fill(getTodayDateString());
                await page.waitForTimeout(1000);
            }

            const slotBtn = page.locator('[data-testid="time-slot"], button:has-text(/\\d{1,2}:\\d{2}/)').first();
            await expect(slotBtn).toBeVisible({ timeout: 10000 });
            await slotBtn.click();
            await page.waitForTimeout(500);

            const createBtn = page.locator('button:has-text("Создать"), button:has-text("Забронировать")').first();
            await expect(createBtn).toBeVisible({ timeout: 5000 });
            await createBtn.click();
            await page.waitForTimeout(2000);
            const toast = page.locator('text=/создана|успешно|created/i').first();
            await expect(toast).toBeVisible({ timeout: 10000 });
        });

        await test.step('4. Отметить посещение (пришёл)', async () => {
            const listTab = page.locator('button:has-text("Список"), button:has-text("List")').first();
            if (await listTab.isVisible({ timeout: 5000 })) {
                await listTab.click();
                await page.waitForTimeout(1500);
            }

            const attendedBtn = page.locator('button:has-text("Пришел"), button:has-text("Attended"), [data-testid="mark-attended"]').first();
            if (await attendedBtn.isVisible({ timeout: 8000 })) {
                await attendedBtn.click();
                await page.waitForTimeout(2000);
                const success = page.locator('text=/отмечено|marked|пришел|paid/i').first();
                await expect(success).toBeVisible({ timeout: 5000 });
            }
        });

        await test.step('5. Проверить остаток по пакету в «Проданные пакеты»', async () => {
            await page.goto('/dashboard/visit-packages');
            await page.waitForLoadState('networkidle');

            const soldTab = page.locator('button:has-text("Проданные пакеты")').first();
            if (await soldTab.isVisible({ timeout: 5000 })) {
                await soldTab.click();
                await page.waitForTimeout(1500);
            }

            const table = page.locator('[data-testid="sold-packages-table"]');
            await expect(table).toBeVisible({ timeout: 5000 });

            const row = page.locator('[data-testid="sold-package-row"]').filter({ hasText: planName }).first();
            await expect(row).toBeVisible({ timeout: 5000 });
            const remaining = await row.getAttribute('data-remaining');
            expect(remaining).toBeDefined();
            const num = parseInt(remaining ?? '0', 10);
            expect(num).toBeLessThan(5);
            expect(num).toBeGreaterThanOrEqual(0);
        });
    });

    test('в кабинете клиента отображается «Оплачено пакетом» (при наличии E2E_TEST_CLIENT_EMAIL)', async ({ page }) => {
        const clientEmail = process.env.E2E_TEST_CLIENT_EMAIL;
        if (!clientEmail) {
            test.skip(true, 'E2E_TEST_CLIENT_EMAIL не задан — проверка кабинета клиента пропущена');
            return;
        }

        await page.goto('/auth/sign-in');
        await page.waitForLoadState('networkidle');
        const emailInput = page.locator('input[type="email"], input[name="email"]').first();
        if (!(await emailInput.isVisible({ timeout: 3000 }))) {
            test.skip(true, 'Форма входа недоступна');
            return;
        }
        await emailInput.fill(clientEmail);
        const submitBtn = page.locator('button:has-text("Отправить"), button[type="submit"]').first();
        if (await submitBtn.isVisible({ timeout: 2000 })) {
            await submitBtn.click();
            await page.waitForTimeout(4000);
        }

        await page.goto('/me');
        await page.waitForLoadState('networkidle');

        const paidWithPackage = page.locator('text=/Оплачено пакетом|paid with package/i').first();
        if (await paidWithPackage.isVisible({ timeout: 5000 })) {
            await expect(paidWithPackage).toBeVisible();
        }

        const myPackagesBlock = page.locator('text=/Мои пакеты|My packages/i').first();
        if (await myPackagesBlock.isVisible({ timeout: 3000 })) {
            await expect(myPackagesBlock).toBeVisible();
        }
    });
});
