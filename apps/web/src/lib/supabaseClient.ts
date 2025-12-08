import { createBrowserClient } from '@supabase/ssr';

/**
 * Клиент Supabase для использования в клиентских компонентах
 * Использует createBrowserClient из @supabase/ssr для правильной работы с cookies и сессиями
 */
export const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);