import { createClient } from '@supabase/supabase-js';

/**
 * Клиент Supabase для использования в клиентских компонентах
 * Использует обычный createClient, который работает с localStorage
 */
export const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
        },
    }
);