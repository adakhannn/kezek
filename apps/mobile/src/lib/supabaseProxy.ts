import {
    createSupabaseProxyFetch,
    resolveSupabaseProxyConfig,
    toDisplayStorageUrl,
    type SupabaseProxyConfig,
} from '@shared-client/supabaseProxy';
import Constants from 'expo-constants';

/**
 * App side of the optional Supabase proxy (R25-31, B1). `EXPO_PUBLIC_SUPABASE_PROXY_URL` (absolute, e.g.
 * `https://kezek.vercel.app/sb`) is inlined into the build by EAS. Unset: the proxy is off, requests and
 * photo URLs go to Supabase exactly as before. Needs a new build; installed builds are not affected.
 */
export function appSupabaseUrl(): string | undefined {
    return process.env.EXPO_PUBLIC_SUPABASE_URL || Constants.expoConfig?.extra?.supabaseUrl;
}

export function appSupabaseProxyConfig(
    supabaseUrl: string | undefined = appSupabaseUrl(),
    proxyUrl: string | undefined = process.env.EXPO_PUBLIC_SUPABASE_PROXY_URL,
): SupabaseProxyConfig | null {
    // No relative form in the app: there is no current origin to resolve it against.
    return resolveSupabaseProxyConfig(supabaseUrl, proxyUrl, null);
}

/** Proxy-aware base fetch for the Supabase client, or null when the proxy is off. */
export function appSupabaseProxyFetch(config: SupabaseProxyConfig | null = appSupabaseProxyConfig()): typeof fetch | null {
    return config ? createSupabaseProxyFetch(config, (input, init) => fetch(input, init)) : null;
}

let cachedConfig: SupabaseProxyConfig | null | undefined;

/** A stored staff photo URL for display: through the proxy when it is on, otherwise unchanged. */
export function displayStorageUrl<T extends string | null | undefined>(url: T): T {
    if (!url) return url;
    if (cachedConfig === undefined) cachedConfig = appSupabaseProxyConfig();
    return toDisplayStorageUrl(url, cachedConfig);
}

/** Tests only. */
export function resetSupabaseProxyCacheForTests(): void {
    cachedConfig = undefined;
}
