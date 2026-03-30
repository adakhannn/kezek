// apps/web/src/lib/supabaseHelpers.ts

/**
 * Утилиты для создания Supabase клиентов
 * Устраняет дублирование кода создания клиентов в API routes
 */

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import { 
    getSupabaseUrl, 
    getSupabaseAnonKey, 
    getSupabaseServiceRoleKey 
} from './env';

/**
 * Создает Supabase клиент для серверных компонентов (с cookies)
 * Используется для операций с RLS политиками
 */
export async function createSupabaseServerClient() {
    const cookieStore = await cookies();
    const url = getSupabaseUrl();
    const anon = getSupabaseAnonKey();

    return createServerClient(url, anon, {
        cookies: {
            get: (n: string) => cookieStore.get(n)?.value,
            set: () => {},
            remove: () => {},
        },
    });
}

/**
 * Создает Supabase клиент с service role key (обход RLS)
 * Используется для административных операций
 */
export function createSupabaseAdminClient() {
    const url = getSupabaseUrl();
    const service = getSupabaseServiceRoleKey();

    return createClient(url, service, {
        auth: { persistSession: false },
    });
}

/**
 * Создает публичный/анонимный Supabase клиент без cookies и без session persistence.
 * Используется для public API routes, где авторизация пользователя не требуется.
 */
export function createSupabaseAnonClient() {
    const url = getSupabaseUrl();
    const anon = getSupabaseAnonKey();

    return createClient(url, anon, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
}

/**
 * Создает оба клиента (server и admin) одновременно
 * Удобно когда нужны оба клиента
 */
export async function createSupabaseClients() {
    return {
        supabase: await createSupabaseServerClient(),
        admin: createSupabaseAdminClient(),
    };
}

