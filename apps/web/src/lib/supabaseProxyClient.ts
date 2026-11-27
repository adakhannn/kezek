import {
    createSupabaseProxyFetch,
    resolveSupabaseProxyConfig,
    toDisplayStorageUrl,
    type SupabaseProxyConfig,
} from '@shared-client/supabaseProxy';

/**
 * Browser side of the optional Supabase proxy (R25-31, B1). `NEXT_PUBLIC_SUPABASE_PROXY_URL` (e.g. `/sb`
 * or `https://kezek.vercel.app/sb`) is inlined at build time; unset means the proxy is off and nothing
 * here changes a request or a URL.
 */
export function browserSupabaseProxyConfig(
    supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
    proxyUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_PROXY_URL,
    currentOrigin: string | null = typeof window === 'undefined' ? null : window.location.origin,
): SupabaseProxyConfig | null {
    return resolveSupabaseProxyConfig(supabaseUrl, proxyUrl, currentOrigin);
}

/** Options for createBrowserClient: undefined (exactly as before) while the proxy is off. */
export function browserSupabaseClientOptions(config: SupabaseProxyConfig | null = browserSupabaseProxyConfig()) {
    if (!config) return undefined;
    return { global: { fetch: createSupabaseProxyFetch(config, (input, init) => fetch(input, init)) } };
}

/**
 * A stored staff photo URL for an `<img>`. A relative proxy URL works in server rendering too, so it is
 * resolved against a placeholder origin and returned as a same-origin path.
 */
export function displayAvatarUrl<T extends string | null | undefined>(
    url: T,
    supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
    proxyUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_PROXY_URL,
): T {
    if (!url || !proxyUrl?.trim()) return url;
    const relative = proxyUrl.trim().startsWith('/') && !proxyUrl.trim().startsWith('//');
    const placeholder = 'https://same-origin.invalid';
    const config = resolveSupabaseProxyConfig(supabaseUrl, proxyUrl, relative ? placeholder : null);
    const rewritten = toDisplayStorageUrl(url, config);
    if (relative && rewritten && rewritten.startsWith(placeholder)) return rewritten.slice(placeholder.length) as T;
    return rewritten;
}
