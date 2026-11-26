// apps/web/src/lib/supabaseHelpers.ts

/**
 * Утилиты для создания Supabase клиентов
 * Устраняет дублирование кода создания клиентов в API routes
 */

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies, headers } from 'next/headers';

import { 
    getSupabaseUrl, 
    getSupabaseAnonKey, 
} from './env';
import { getServiceClient } from './supabaseService';

import type { Database } from '@/types/supabase';

/**
 * Создает Supabase клиент для серверных компонентов (с cookies)
 * Используется для операций с RLS политиками
 */
export async function createSupabaseServerClient() {
    // The mobile app calls the same routes with `Authorization: Bearer <access token>` instead of
    // the web session cookie: the caller is then that token, everywhere this client is used.
    const bearer = await readBearerToken();
    if (bearer) return createBearerServerClient(bearer);

    const cookieStore = await cookies();
    const url = getSupabaseUrl();
    const anon = getSupabaseAnonKey();

    return createServerClient<Database>(url, anon, {
        cookies: {
            get: (n: string) => cookieStore.get(n)?.value,
            set: () => {},
            remove: () => {},
        },
    });
}

/** The `Authorization: Bearer` token of the current request (the mobile app), or null. */
async function readBearerToken(): Promise<string | null> {
    let header = '';
    try {
        header = (await headers()).get('authorization') ?? '';
    } catch {
        // Outside a request scope (scripts, some tests): only the cookie session applies.
        return null;
    }
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
    return token || null;
}

/**
 * An RLS client acting as the Bearer token's user. A header-only client keeps no session, so
 * `auth.getUser()` without an argument would answer "no session": it is bound to the token here,
 * which makes the existing `getUser()` calls of every route validate the mobile token. The type is
 * the cookie client's, so callers do not change.
 */
function createBearerServerClient(token: string): ReturnType<typeof createServerClient<Database>> {
    const client = createClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const getUser = client.auth.getUser.bind(client.auth);
    client.auth.getUser = (jwt?: string) => getUser(jwt ?? token);
    return client as unknown as ReturnType<typeof createServerClient<Database>>;
}

/** Service-role client (bypasses RLS); the same client as getServiceClient. */
export function createSupabaseAdminClient() {
    return getServiceClient();
}

/**
 * Создает публичный/анонимный Supabase клиент без cookies и без session persistence.
 * Используется для public API routes, где авторизация пользователя не требуется.
 */
export function createSupabaseAnonClient() {
    const url = getSupabaseUrl();
    const anon = getSupabaseAnonKey();

    return createClient<Database>(url, anon, {
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

