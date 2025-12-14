import { createBrowserClient } from '@supabase/ssr';

/**
 * Клиент Supabase для использования в клиентских компонентах
 * Использует createBrowserClient из @supabase/ssr для правильной работы с cookies и сессиями
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.'
    );
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);