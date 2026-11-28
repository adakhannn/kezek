import { createBrowserClient } from '@supabase/ssr';

import { logWarnSafe } from './logSafe';
import { browserSupabaseClientOptions } from './supabaseProxyClient';

/**
 * Клиент Supabase для использования в клиентских компонентах
 * Использует createBrowserClient из @supabase/ssr для правильной работы с cookies и сессиями
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function isValidHttpUrl(value: string | undefined): value is string {
    if (!value) return false;
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

const hasValidBrowserConfig = isValidHttpUrl(supabaseUrl) && !!supabaseAnonKey?.trim();
const resolvedSupabaseUrl = hasValidBrowserConfig ? supabaseUrl! : 'https://invalid.supabase.co';
const resolvedSupabaseAnonKey = hasValidBrowserConfig ? supabaseAnonKey! : 'invalid-anon-key';

if (!hasValidBrowserConfig && typeof window !== 'undefined') {
    logWarnSafe(
        'Supabase', 'Public runtime configuration is invalid; auth and data requests are disabled until configuration is fixed.',
    );
}

// R25-31: with NEXT_PUBLIC_SUPABASE_PROXY_URL set, requests go through our /sb proxy while the client URL
// (and so the session cookie name) stays the project's own. Unset: no options, as before.
const proxyOptions = hasValidBrowserConfig ? browserSupabaseClientOptions() : undefined;

export const supabase = proxyOptions
    ? createBrowserClient(resolvedSupabaseUrl, resolvedSupabaseAnonKey, proxyOptions)
    : createBrowserClient(
        resolvedSupabaseUrl,
        resolvedSupabaseAnonKey,
    );
