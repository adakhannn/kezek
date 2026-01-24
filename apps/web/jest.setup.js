// Глобальная настройка для тестов
// Мокируем переменные окружения
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-key';
process.env.CRON_SECRET = process.env.CRON_SECRET || 'test-cron-secret';
process.env.VERCEL_CRON_SECRET = process.env.VERCEL_CRON_SECRET || 'test-cron-secret';

// Увеличиваем таймаут для асинхронных операций
jest.setTimeout(30000);

