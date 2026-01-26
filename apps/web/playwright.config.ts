import { defineConfig, devices } from '@playwright/test';

/**
 * E2E тесты для критичных пользовательских сценариев
 * 
 * Для запуска тестов:
 * - pnpm test:e2e - запустить все тесты
 * - pnpm test:e2e:ui - запустить с UI
 * - pnpm test:e2e:headed - запустить в видимом браузере
 */
export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    webServer: {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
    },
});

