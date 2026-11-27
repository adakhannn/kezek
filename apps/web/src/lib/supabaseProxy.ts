import {
    SUPABASE_PROXY_DISABLED,
    SUPABASE_PROXY_PATH_PREFIXES,
    SUPABASE_PROXY_STATUS_HEADER,
} from '@shared-client/supabaseProxy';

import { logWarn } from './log';
import { checkRateLimit, type RateLimitConfig, type RateLimitResult } from './rateLimit';

/**
 * Same-origin proxy of the Supabase project for networks where `*.supabase.co` is blocked
 * (R25-31, option B1; docs/SUPABASE_ACCESS_OPTIONS.md). `/sb/<rest|auth|storage>/v1/...` is forwarded to
 * the ONE project origin from server env. Off unless `SUPABASE_PROXY_ENABLED=true`: then every path answers
 * 404 and nothing is sent anywhere.
 *
 * A route handler (not a next.config rewrite) so that: the switch is read at request time; cookies,
 * forwarding and other request headers are dropped; responses are never cached by the CDN or Next; and
 * OTP/verify calls get a per-client limit before Supabase sees them all from a few Vercel addresses.
 */

export const SUPABASE_PROXY_ROUTE_PREFIX = '/sb';

/** Vercel Functions reject request bodies above 4.5 MB before our code runs; this mirrors it with a clear 413. */
export const SUPABASE_PROXY_MAX_BODY_BYTES = 4_500_000;
export const SUPABASE_PROXY_UPSTREAM_TIMEOUT_MS = 30_000;

/** Admin endpoints need the service key and are never called from a browser or the app. */
const BLOCKED_PREFIXES = ['/auth/v1/admin'];

/** Request headers supabase-js (auth, PostgREST, storage) needs. Everything else, cookies included, is dropped. */
export const FORWARDED_REQUEST_HEADERS = [
    'accept',
    'accept-profile',
    'apikey',
    'authorization',
    'cache-control',
    'content-profile',
    'content-type',
    'if-modified-since',
    'if-none-match',
    'prefer',
    'range',
    'user-agent',
    'x-client-info',
    'x-metadata',
    'x-supabase-api-version',
    'x-upsert',
] as const;

/** Response headers passed back. No set-cookie, CORS, cache, encoding/length (the body is re-streamed decoded). */
export const FORWARDED_RESPONSE_HEADERS = [
    'accept-ranges',
    'content-disposition',
    'content-language',
    'content-location',
    'content-range',
    'content-type',
    'etag',
    'last-modified',
    'location',
    'preference-applied',
    'range-unit',
    'retry-after',
    'www-authenticate',
    'x-supabase-api-version',
] as const;

/** Auth calls that send a code or check one: limited per client before they share the Vercel addresses' budget. */
const LIMITED_AUTH_PATHS = new Set([
    '/auth/v1/otp',
    '/auth/v1/verify',
    '/auth/v1/signup',
    '/auth/v1/recover',
    '/auth/v1/resend',
    '/auth/v1/magiclink',
]);
/** Same numbers Supabase applies per IP to these endpoints by default (30 per 5 minutes). */
export const SUPABASE_PROXY_AUTH_LIMIT: RateLimitConfig = { maxRequests: 30, windowMs: 5 * 60_000 };

export const PRIVATE_CACHE_CONTROL = 'private, no-store';
export const PUBLIC_FILE_CACHE_CONTROL = 'public, max-age=3600';

type Env = Record<string, string | undefined>;

export function isSupabaseProxyEnabled(env: Env = process.env): boolean {
    return env.SUPABASE_PROXY_ENABLED?.trim() === 'true';
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** The project origin from server env; never anything from the request. */
export function getSupabaseUpstreamOrigin(env: Env = process.env): string | null {
    const raw = env.NEXT_PUBLIC_SUPABASE_URL?.trim() || env.SUPABASE_URL?.trim();
    if (!raw) return null;
    try {
        const url = new URL(raw);
        if (url.protocol === 'https:' || (url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname))) return url.origin;
        return null;
    } catch {
        return null;
    }
}

/**
 * The upstream URL for `/sb/<path>?<query>`, or null when the path is not one of the allowed prefixes or tries
 * to leave it (`..`, encoded slashes, backslashes). The origin is always `upstreamOrigin`.
 */
export function resolveUpstreamUrl(pathname: string, search: string, upstreamOrigin: string): URL | null {
    if (!pathname.startsWith(`${SUPABASE_PROXY_ROUTE_PREFIX}/`)) return null;
    const rest = pathname.slice(SUPABASE_PROXY_ROUTE_PREFIX.length);
    if (rest.includes('\\') || rest.includes('//')) return null;
    for (const segment of rest.split('/')) {
        let decoded: string;
        try {
            decoded = decodeURIComponent(segment);
        } catch {
            return null;
        }
        if (decoded === '.' || decoded === '..' || decoded.includes('/') || decoded.includes('\\')) return null;
    }
    const allowed = (path: string) => SUPABASE_PROXY_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))
        && !BLOCKED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
    if (!allowed(rest)) return null;
    const target = new URL(rest + search, upstreamOrigin);
    if (target.origin !== upstreamOrigin || !allowed(target.pathname)) return null;
    return target;
}

export function filterRequestHeaders(source: Headers): Headers {
    const headers = new Headers();
    for (const name of FORWARDED_REQUEST_HEADERS) {
        const value = source.get(name);
        if (value !== null) headers.set(name, value);
    }
    return headers;
}

function isPublicFileRead(method: string, pathname: string, status: number): boolean {
    return (method === 'GET' || method === 'HEAD') && status === 200
        && (pathname.startsWith('/storage/v1/object/public/') || pathname.startsWith('/storage/v1/render/image/public/'));
}

/** Response headers for the client: allow-listed upstream headers plus our cache policy. */
export function buildResponseHeaders(upstream: Headers, method: string, pathname: string, status: number): Headers {
    const headers = new Headers();
    for (const name of FORWARDED_RESPONSE_HEADERS) {
        const value = upstream.get(name);
        if (value !== null) headers.set(name, value);
    }
    // Public staff photos may sit in the browser cache; nothing is ever stored by Vercel's CDN.
    headers.set('Cache-Control', isPublicFileRead(method, pathname, status) ? PUBLIC_FILE_CACHE_CONTROL : PRIVATE_CACHE_CONTROL);
    headers.set('CDN-Cache-Control', 'no-store');
    headers.set('Vercel-CDN-Cache-Control', 'no-store');
    headers.set('X-Content-Type-Options', 'nosniff');
    return headers;
}

function plain(status: number, body: object | null, extra: Record<string, string> = {}): Response {
    return new Response(body === null ? null : JSON.stringify(body), {
        status,
        headers: {
            'Cache-Control': PRIVATE_CACHE_CONTROL,
            ...(body === null ? {} : { 'Content-Type': 'application/json' }),
            ...extra,
        },
    });
}

/** Statuses whose Response must not carry a body. */
const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

export type SupabaseProxyDeps = {
    fetch?: typeof fetch;
    env?: Env;
    rateLimit?: (req: Request, config: RateLimitConfig, routeId: string) => Promise<RateLimitResult>;
    timeoutMs?: number;
};

export async function handleSupabaseProxyRequest(req: Request, deps: SupabaseProxyDeps = {}): Promise<Response> {
    const env = deps.env ?? process.env;
    if (!isSupabaseProxyEnabled(env)) {
        return plain(404, null, { [SUPABASE_PROXY_STATUS_HEADER]: SUPABASE_PROXY_DISABLED });
    }
    const upstreamOrigin = getSupabaseUpstreamOrigin(env);
    if (!upstreamOrigin) {
        logWarn('SupabaseProxy', 'Proxy is enabled but the Supabase URL is missing or invalid');
        return plain(503, { error: 'proxy_misconfigured' });
    }
    const requestUrl = new URL(req.url);
    const target = resolveUpstreamUrl(requestUrl.pathname, requestUrl.search, upstreamOrigin);
    if (!target) return plain(404, { error: 'not_found' });

    const method = req.method.toUpperCase();
    if (method === 'POST' && LIMITED_AUTH_PATHS.has(target.pathname)) {
        const limited = await (deps.rateLimit ?? checkRateLimit)(req, SUPABASE_PROXY_AUTH_LIMIT, `${SUPABASE_PROXY_ROUTE_PREFIX}${target.pathname}`);
        // Only a real "over the limit" stops the request. A limiter that is unavailable or not configured
        // must not break sign-in: Supabase's own limit still applies behind it.
        if (!limited.success && !limited.unavailable) {
            const retryAfter = String(limited.retryAfter ?? 60);
            // The body Supabase Auth itself returns for this case, so clients handle it the same way.
            return plain(429, { code: 429, error_code: 'over_request_rate_limit', msg: 'Request rate limit reached' }, { 'Retry-After': retryAfter });
        }
    }

    let body: ArrayBuffer | undefined;
    if (method !== 'GET' && method !== 'HEAD') {
        const declared = Number(req.headers.get('content-length') ?? '0');
        if (Number.isFinite(declared) && declared > SUPABASE_PROXY_MAX_BODY_BYTES) return plain(413, { error: 'payload_too_large' });
        body = await req.arrayBuffer();
        if (body.byteLength > SUPABASE_PROXY_MAX_BODY_BYTES) return plain(413, { error: 'payload_too_large' });
    }

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, deps.timeoutMs ?? SUPABASE_PROXY_UPSTREAM_TIMEOUT_MS);
    const onClientAbort = () => controller.abort();
    req.signal?.addEventListener('abort', onClientAbort, { once: true });

    let upstream: Response;
    try {
        upstream = await (deps.fetch ?? fetch)(target, {
            method,
            headers: filterRequestHeaders(req.headers),
            body,
            // A redirect (OAuth authorize) goes back to the client as is; it is not followed here.
            redirect: 'manual',
            // Never let Next's data cache keep a private answer.
            cache: 'no-store',
            signal: controller.signal,
        });
    } catch {
        // No query string in logs: PostgREST filters can carry personal data.
        logWarn('SupabaseProxy', timedOut ? 'Upstream timed out' : 'Upstream request failed', {
            method,
            prefix: target.pathname.split('/').slice(0, 3).join('/'),
        });
        return plain(timedOut ? 504 : 502, { error: timedOut ? 'supabase_timeout' : 'supabase_unreachable' });
    } finally {
        clearTimeout(timer);
        req.signal?.removeEventListener('abort', onClientAbort);
    }

    const headers = buildResponseHeaders(upstream.headers, method, target.pathname, upstream.status);
    const passBody = method !== 'HEAD' && !NULL_BODY_STATUSES.has(upstream.status);
    return new Response(passBody ? upstream.body : null, { status: upstream.status, statusText: upstream.statusText, headers });
}
