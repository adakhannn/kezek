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

// Увеличиваем таймаут для асинхронных операций
jest.setTimeout(30000);

