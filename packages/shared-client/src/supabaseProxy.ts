/**
 * Optional routing of the browser and app Supabase traffic through our own origin
 * (`https://kezek.vercel.app/sb/...`), for networks where `*.supabase.co` is blocked (R25-31, option B1).
 *
 * The Supabase client keeps its real project URL, so the session storage key and the auth cookie names
 * (`sb-<ref>-auth-token`) stay the same and nobody is signed out when the proxy is switched on or off.
 * Only the host of each request is swapped inside a custom `fetch`.
 *
 * With no proxy URL configured every function here returns its input unchanged.
 */

/** Path prefixes the server proxy forwards; everything else (functions, realtime, ...) stays direct. */
export const SUPABASE_PROXY_PATH_PREFIXES = ['/rest/v1/', '/auth/v1/', '/storage/v1/'] as const;

/** Header the server adds to its 404 while the proxy is switched off, so clients fall back to the direct address. */
export const SUPABASE_PROXY_STATUS_HEADER = 'x-kezek-sb-proxy';
export const SUPABASE_PROXY_DISABLED = 'disabled';

export type SupabaseProxyConfig = {
    /** Origin of the real project, e.g. `https://<ref>.supabase.co`. */
    supabaseOrigin: string;
    /** Proxy base without a trailing slash, e.g. `https://kezek.vercel.app/sb`. */
    proxyBase: string;
};

function parseHttpUrl(value: string, base?: string): URL | null {
    try {
        const url = base ? new URL(value, base) : new URL(value);
        return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
    } catch {
        return null;
    }
}

/**
 * The proxy configuration, or null (proxy off) when the proxy URL is unset or invalid. A relative proxy
 * URL (`/sb`) is resolved against `currentOrigin` and is off when there is none (server rendering).
 */
export function resolveSupabaseProxyConfig(
    supabaseUrl: string | null | undefined,
    proxyUrl: string | null | undefined,
    currentOrigin?: string | null,
): SupabaseProxyConfig | null {
    const rawProxy = proxyUrl?.trim();
    if (!rawProxy || !supabaseUrl) return null;
    const supabase = parseHttpUrl(supabaseUrl.trim());
    if (!supabase) return null;
    const isRelative = rawProxy.startsWith('/') && !rawProxy.startsWith('//');
    if (isRelative && !currentOrigin) return null;
    const proxy = parseHttpUrl(rawProxy, isRelative ? currentOrigin ?? undefined : undefined);
    if (!proxy || proxy.search || proxy.hash || proxy.username || proxy.password) return null;
    if (proxy.origin === supabase.origin) return null;
    return { supabaseOrigin: supabase.origin, proxyBase: proxy.origin + proxy.pathname.replace(/\/+$/, '') };
}

/**
 * `https://<ref>.supabase.co/<allowed path>` -> `<proxyBase>/<allowed path>`; any other URL (another host,
 * a path the proxy does not serve, or proxy off) is returned unchanged.
 */
export function toProxiedSupabaseUrl(url: string, config: SupabaseProxyConfig | null): string {
    if (!config || !url.startsWith(config.supabaseOrigin)) return url;
    const rest = url.slice(config.supabaseOrigin.length);
    if (!SUPABASE_PROXY_PATH_PREFIXES.some((prefix) => rest.startsWith(prefix))) return url;
    return config.proxyBase + rest;
}

/** A stored public file URL (staff photo) for display: through the proxy when it is on, else unchanged. */
export function toDisplayStorageUrl<T extends string | null | undefined>(url: T, config: SupabaseProxyConfig | null): T {
    if (!url || !config) return url;
    return toProxiedSupabaseUrl(url, config) as T;
}

function isAbortError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError';
}

/**
 * `fetch` for `createClient(..., { global: { fetch } })`. Requests to the Supabase project go to the proxy.
 * Falls back to the direct address
 * - for the rest of the session when the server answers that the proxy is switched off (nothing was sent
 *   to Supabase, so any method is safe to repeat);
 * - for one GET/HEAD whose proxy request failed at the network level (a write is not repeated: it may have
 *   reached Supabase).
 * A caller's abort (timeouts included) is never retried.
 */
export function createSupabaseProxyFetch(
    config: SupabaseProxyConfig | null,
    baseFetch: typeof fetch = fetch,
): typeof fetch {
    if (!config) return baseFetch;
    let proxyDisabled = false;
    return async (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : null;
        if (proxyDisabled || url === null) return baseFetch(input, init);
        const proxied = toProxiedSupabaseUrl(url, config);
        if (proxied === url) return baseFetch(input, init);
        const method = (init?.method ?? 'GET').toUpperCase();
        let response: Response;
        try {
            response = await baseFetch(proxied, init);
        } catch (error) {
            if (isAbortError(error) || (method !== 'GET' && method !== 'HEAD')) throw error;
            return baseFetch(input, init);
        }
        if (response.status === 404 && response.headers.get(SUPABASE_PROXY_STATUS_HEADER) === SUPABASE_PROXY_DISABLED) {
            proxyDisabled = true;
            return baseFetch(input, init);
        }
        return response;
    };
}
