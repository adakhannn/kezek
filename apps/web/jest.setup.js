// Глобальная настройка для тестов
// Мокируем переменные окружения
// Unit tests must use their own clients and must never inherit access to a real DB.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

// A missing HTTP mock should fail immediately instead of sending a real request.
global.fetch = jest.fn(() =>
    Promise.reject(new Error('External requests are disabled in unit tests. Mock fetch explicitly.')),
);
process.env.CRON_SECRET = 'test-cron-secret';
process.env.VERCEL_CRON_SECRET = 'test-cron-secret';

// Tests render every locale synchronously; the app loads en/ky on demand (FE-06).
{
    const { rememberDictionary } = require('./src/app/_components/i18n/dictionaryLoader');
    rememberDictionary('en', require('./src/app/_components/i18n/dictionaries/en').en);
    rememberDictionary('ky', require('./src/app/_components/i18n/dictionaries/ky').ky);
}

// API route tests (src/__tests__/api): the shared module mocks (CI-04). A route imports these modules
// while it loads, so their mocks must exist before the test file runs. Registered from a helper the
// test file called after importing the route (the former setupApiTestMocks), they came too late and
// the real rate limiter, next/headers and Supabase clients ran. A test file's own jest.mock of the
// same module still replaces these.
if (/[\\/]__tests__[\\/]api[\\/]/.test(expect.getState().testPath || '')) {
    jest.mock('@/lib/rateLimit', () => ({
        ...jest.requireActual('@/lib/rateLimit'),
        withRateLimit: jest.fn((req, config, handler) => handler()),
    }));
    jest.mock('next/headers', () => ({ cookies: jest.fn(), headers: jest.fn() }));
    jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
    jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }));
}

// Увеличиваем таймаут для асинхронных операций
jest.setTimeout(30000);

