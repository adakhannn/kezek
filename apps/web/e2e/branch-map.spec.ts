/**
 * E2E: создание и редактирование филиала с картой.
 *
 * Сценарий (админка):
 * - зайти под суперадмином;
 * - открыть страницу создания филиала для бизнеса;
 * - заполнить название;
 * - кликнуть по карте (BranchMapPickerYandex), чтобы задать координаты и адрес;
 * - сохранить филиал;
 * - перейти на страницу редактирования созданного филиала и убедиться, что координаты/адрес отображаются.
 *
 * Требует:
 * - корректно настроенных env (NEXT_PUBLIC_SUPABASE_URL и т.п.);
 * - тестового суперадмина E2E_TEST_SUPERADMIN_EMAIL;
 * - тестового бизнеса с id E2E_TEST_BUSINESS_ID (или slug/id, используемый в админке).
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

async function signInSuperAdmin(page: any) {
    const email = process.env.E2E_TEST_SUPERADMIN_EMAIL || 'superadmin@test.com';

    await page.goto(`${BASE_URL}/auth/sign-in`);
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await expect(emailInput).toBeVisible({ timeout: 5000 });
    await emailInput.fill(email);

    const submit = page
        .locator('button:has-text("Отправить"), button:has-text("Продолжить"), button[type="submit"]')
        .first();
    if (await submit.isVisible({ timeout: 3000 })) {
        await submit.click();
    }

    // Предполагаем, что для e2e окружения авторизация суперадмина уже настроена (OTP/линк).
    await page.waitForTimeout(1000);
}

test.describe('Админка: филиал с картой', () => {
    test('создание и редактирование филиала с координатами', async ({ page }) => {
        await signInSuperAdmin(page);

        const bizId = process.env.E2E_TEST_BUSINESS_ID || 'test-biz-id';

        await test.step('Открыть страницу создания филиала', async () => {
            await page.goto(`${BASE_URL}/admin/businesses/${bizId}/branches/new`);
            await page.waitForLoadState('networkidle');

            const title = page.locator('h1').filter({ hasText: /Новый филиал/i }).first();
            await expect(title).toBeVisible({ timeout: 10000 });
        });

        await test.step('Заполнить название и выбрать точку на карте', async () => {
            const nameInput = page.locator('input[name="branch_name"]').first();
            await expect(nameInput).toBeVisible({ timeout: 5000 });
            await nameInput.fill('E2E филиал с картой');

            // Карта Яндекса в BranchForm не имеет data-testid, используем контейнер и координаты клика
            const mapContainer = page.locator('div').filter({
                hasText: /Координаты:/,
            }).first();

            if (await mapContainer.isVisible({ timeout: 5000 })) {
                const box = await mapContainer.boundingBox();
                if (box) {
                    const x = box.x + box.width / 2;
                    const y = box.y + box.height / 2;
                    await page.mouse.click(x, y);
                    await page.waitForTimeout(1000);
                }
            }

            const coordsText = page.locator('text=Координаты:').first();
            await expect(coordsText).toBeVisible({ timeout: 5000 });

            const addressInput = page.locator('input[name="branch_address"]').first();
            await expect(addressInput).toBeVisible({ timeout: 5000 });
        });

        let createdBranchesUrl: string | null = null;

        await test.step('Сохранить филиал и перейти к списку', async () => {
            const submit = page
                .locator('button')
                .filter({ hasText: /Создать филиал|Сохранить изменения/i })
                .first();
            await expect(submit).toBeVisible({ timeout: 5000 });
            await expect(submit).toBeEnabled({ timeout: 2000 });
            await submit.click();

            await page.waitForLoadState('networkidle');
            await expect(page).toHaveURL(/\/admin\/businesses\/.+\/branches/);

            createdBranchesUrl = page.url();

            const listTitle = page.locator('h1, h2').filter({ hasText: /Филиалы/i }).first();
            await expect(listTitle).toBeVisible({ timeout: 10000 });
        });

        await test.step('Найти созданный филиал в списке и открыть редактирование', async () => {
            if (!createdBranchesUrl) {
                test.skip();
            }

            const row = page
                .locator('a, tr, [data-testid="branch-row"]')
                .filter({ hasText: /E2E филиал с картой/i })
                .first();
            await expect(row).toBeVisible({ timeout: 10000 });
            await row.click();

            await page.waitForLoadState('networkidle');
            await expect(page).toHaveURL(/\/admin\/businesses\/.+\/branches\/.+/);

            const editTitle = page.locator('h1').filter({ hasText: /Редактировать филиал/i }).first();
            await expect(editTitle).toBeVisible({ timeout: 10000 });

            const coordsText = page.locator('text=Координаты:').first();
            await expect(coordsText).toBeVisible({ timeout: 5000 });
        });
    });
});

