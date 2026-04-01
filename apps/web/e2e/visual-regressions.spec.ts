/**
 * Визуальные регрессии (базовый набор).
 *
 * Использует встроенный механизм Playwright `toHaveScreenshot` для проверки,
 * что ключевые публичные страницы не меняются неожиданно.
 *
 * Запускается вместе с остальными e2e-тестами:
 *   pnpm -C apps/web test:e2e -- visual-regressions.spec.ts
 */

import { test, expect } from '@playwright/test';
import { getBaseUrl, readRequiredEnv, skipIfMissingE2EEnv } from './testEnv';

const BASE_URL = getBaseUrl();
skipIfMissingE2EEnv('visual-regressions.spec.ts', ['E2E_TEST_BUSINESS_SLUG']);

test.describe('Визуальные регрессии ключевых страниц', () => {
    test('публичная страница бизнеса стабильна визуально', async ({ page }) => {
        const businessSlug = readRequiredEnv('E2E_TEST_BUSINESS_SLUG');

        await page.goto(`${BASE_URL}/b/${businessSlug}`, { waitUntil: 'networkidle' });
        await page.setViewportSize({ width: 1280, height: 720 });

        // Небольшой таймаут, чтобы доотрисовались ленивые элементы
        await page.waitForTimeout(1000);

        await expect(page).toHaveScreenshot('business-page.png', {
            fullPage: true,
            maxDiffPixels: 200, // допускаем небольшой шум рендера
        });
    });

    test('страница шага бронирования стабильна визуально', async ({ page }) => {
        const businessSlug = readRequiredEnv('E2E_TEST_BUSINESS_SLUG');

        await page.goto(`${BASE_URL}/b/${businessSlug}`, { waitUntil: 'networkidle' });
        await page.setViewportSize({ width: 1280, height: 720 });

        // Простейший happy-path до шага выбора времени
        const branchSelector = page.locator('[data-testid="branch-select"]').first();
        if (await branchSelector.isVisible()) {
            await branchSelector.click();
            await page.locator('[data-testid="branch-option"]').first().click();
        }

        const masterSelector = page.locator('[data-testid="master-select"]').first();
        if (await masterSelector.isVisible()) {
            await masterSelector.click();
            await page.locator('[data-testid="master-option"]').first().click();
        }

        const serviceSelector = page.locator('[data-testid="service-select"]').first();
        if (await serviceSelector.isVisible()) {
            await serviceSelector.click();
            await page.locator('[data-testid="service-option"]').first().click();
        }

        const datePicker = page.locator('[data-testid="date-picker"]').first();
        if (await datePicker.isVisible()) {
            await datePicker.click();
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate() + 1).padStart(2, '0');
            await page.locator(`[data-date="${year}-${month}-${day}"]`).first().click();
        }

        await page.waitForSelector('[data-testid="time-slot"]', { timeout: 10000 });
        await page.locator('[data-testid="time-slot"]').first().scrollIntoViewIfNeeded();

        // Скриншот шага выбора времени/подтверждения
        await page.waitForTimeout(1000);
        await expect(page).toHaveScreenshot('booking-step-time.png', {
            fullPage: true,
            maxDiffPixels: 200,
        });
    });
});

