import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

/**
 * E2E тесты для критичных пользовательских сценариев.
 *
 * Seeded/auth/visual specs run against a LOCAL Supabase stack with the fixture of
 * scripts/e2e-seed.mjs (see e2e/README.md):
 *   node ../../scripts/e2e-seed.mjs > e2e/.e2e.env   # loaded below when present
 *   pnpm test:e2e:full-seeded
 *
 * E2E_WEB_SERVER=start serves a production build (`pnpm build` first), otherwise `next dev`.
 */

// KEY=VALUE lines written by scripts/e2e-seed.mjs; values already in the environment win.
const envFile = process.env.E2E_ENV_FILE || path.join(__dirname, 'e2e', '.e2e.env');
if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
        const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
        if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
}

// The fixture business works in Asia/Bishkek; the specs' "today" and "tomorrow" follow it.
process.env.TZ ||= 'Asia/Bishkek';

const PORT = Number(process.env.E2E_PORT || 3100);
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || `http://localhost:${PORT}`;

// The suite creates bookings, shifts and packages: it must never run against a real deployment
// or project. Only local hosts are accepted (host.docker.internal: the Playwright container).
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', 'host.docker.internal']);
const PLACEHOLDER_SUPABASE_URL = 'https://placeholder.supabase.co';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || PLACEHOLDER_SUPABASE_URL;
if (!LOCAL_HOSTS.has(new URL(BASE_URL).hostname)) {
    throw new Error(`E2E base URL must be local, got ${BASE_URL}`);
}
if (supabaseUrl !== PLACEHOLDER_SUPABASE_URL && !LOCAL_HOSTS.has(new URL(supabaseUrl).hostname)) {
    throw new Error(`E2E NEXT_PUBLIC_SUPABASE_URL must be a local stack, got ${supabaseUrl}`);
}

const serverCommand =
    process.env.E2E_WEB_SERVER === 'start' ? `pnpm start --port ${PORT}` : `pnpm dev --port ${PORT}`;

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    timeout: 120_000,
    // In CI the github reporter turns every failure into an annotation readable without the logs.
    reporter: process.env.CI
        ? [['list'], ['github'], ['html', { open: 'never' }]]
        : [['list'], ['html', { open: 'never' }]],
    expect: {
        // `next dev` compiles a route on its first visit.
        timeout: 20_000,
        toHaveScreenshot: {
            // Fonts and anti-aliasing differ slightly between runs; layout changes exceed this.
            maxDiffPixelRatio: 0.01,
        },
    },
    use: {
        baseURL: BASE_URL,
        locale: 'ru-RU',
        timezoneId: 'Asia/Bishkek',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    // E2E_SKIP_WEB_SERVER: the app is already served (e.g. on the host for a Playwright container).
    webServer: process.env.E2E_SKIP_WEB_SERVER
        ? undefined
        : {
              command: serverCommand,
              url: BASE_URL,
              reuseExistingServer: !process.env.CI,
              timeout: 180 * 1000,
              env: {
                  ...process.env,
                  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
                  NEXT_PUBLIC_SUPABASE_ANON_KEY:
                      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
                      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder',
              } as Record<string, string>,
          },
});
