jest.mock('@/lib/log', () => ({ logWarn: jest.fn(), logError: jest.fn(), logDebug: jest.fn() }));
jest.mock('@/lib/rateLimit', () => ({ checkRateLimit: jest.fn() }));

import { SUPABASE_PROXY_STATUS_HEADER } from '@shared-client/supabaseProxy';

import * as route from '@/app/sb/[...path]/route';
import { logWarn } from '@/lib/log';
import { checkRateLimit } from '@/lib/rateLimit';
import {
    filterRequestHeaders,
    getSupabaseUpstreamOrigin,
    handleSupabaseProxyRequest,
    isSupabaseProxyEnabled,
    PRIVATE_CACHE_CONTROL,
    PUBLIC_FILE_CACHE_CONTROL,
    resolveUpstreamUrl,
    normalizedProxyPath,
    PROXY_CONTENT_SECURITY_POLICY,
    SUPABASE_PROXY_AUTH_LIMIT,
    SUPABASE_PROXY_TOKEN_LIMIT,
    SUPABASE_PROXY_MAX_BODY_BYTES,
} from '@/lib/supabaseProxy';

const UPSTREAM = 'https://project-ref.supabase.co';
const ON = { SUPABASE_PROXY_ENABLED: 'true', NEXT_PUBLIC_SUPABASE_URL: UPSTREAM };
const SITE = 'https://kezek.vercel.app';

function upstreamFetch(response: Response = new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })) {
    return jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit | undefined]>().mockResolvedValue(response);
}
function call(path: string, init: RequestInit = {}, env: Record<string, string | undefined> = ON, fetchMock = upstreamFetch()) {
    return { fetchMock, response: handleSupabaseProxyRequest(new Request(SITE + path, init), { env, fetch: fetchMock as unknown as typeof fetch }) };
}
const allowed = { success: true, limit: 30, remaining: 29, reset: 0 };

beforeEach(() => {
    jest.clearAllMocks();
    (checkRateLimit as jest.Mock).mockResolvedValue(allowed);
});

describe('switch (off by default)', () => {
    test('off unless SUPABASE_PROXY_ENABLED is exactly "true"', () => {
        expect(isSupabaseProxyEnabled({})).toBe(false);
        expect(isSupabaseProxyEnabled({ SUPABASE_PROXY_ENABLED: '1' })).toBe(false);
        expect(isSupabaseProxyEnabled({ SUPABASE_PROXY_ENABLED: 'false' })).toBe(false);
        expect(isSupabaseProxyEnabled({ SUPABASE_PROXY_ENABLED: 'true' })).toBe(true);
    });

    test.each(['GET', 'POST', 'DELETE'])('gate off: %s answers 404 and sends nothing upstream', async (method) => {
        const { fetchMock, response } = call('/sb/rest/v1/bookings?select=*', { method, body: method === 'GET' ? undefined : '{}' },
            { NEXT_PUBLIC_SUPABASE_URL: UPSTREAM });
        const res = await response;
        expect(res.status).toBe(404);
        expect(res.headers.get(SUPABASE_PROXY_STATUS_HEADER)).toBe('disabled');
        expect(res.headers.get('cache-control')).toBe(PRIVATE_CACHE_CONTROL);
        expect(res.headers.get('content-security-policy')).toBe(PROXY_CONTENT_SECURITY_POLICY);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(checkRateLimit).not.toHaveBeenCalled();
    });

    test('the route itself is off with the env of this test run (no SUPABASE_PROXY_ENABLED)', async () => {
        delete process.env.SUPABASE_PROXY_ENABLED;
        const res = await route.GET(new Request(`${SITE}/sb/auth/v1/health`));
        expect(res.status).toBe(404);
        expect(global.fetch).not.toHaveBeenCalled();
        for (const method of ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const) {
            expect(typeof route[method]).toBe('function');
        }
    });

    test('on but without a usable Supabase URL: 503, nothing sent', async () => {
        const { fetchMock, response } = call('/sb/rest/v1/x', {}, { SUPABASE_PROXY_ENABLED: 'true' });
        expect((await response).status).toBe(503);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe('fixed upstream host and path allow-list', () => {
    test('upstream comes from env only; plain http is refused except loopback', () => {
        expect(getSupabaseUpstreamOrigin({ NEXT_PUBLIC_SUPABASE_URL: `${UPSTREAM}/` })).toBe(UPSTREAM);
        expect(getSupabaseUpstreamOrigin({ SUPABASE_URL: UPSTREAM })).toBe(UPSTREAM);
        expect(getSupabaseUpstreamOrigin({ NEXT_PUBLIC_SUPABASE_URL: 'http://evil.example' })).toBeNull();
        expect(getSupabaseUpstreamOrigin({ NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321' })).toBe('http://127.0.0.1:54321');
        expect(getSupabaseUpstreamOrigin({ NEXT_PUBLIC_SUPABASE_URL: 'not a url' })).toBeNull();
    });

    test.each([
        ['/sb/rest/v1/bookings', '?select=id&biz_id=eq.1', `${UPSTREAM}/rest/v1/bookings?select=id&biz_id=eq.1`],
        ['/sb/auth/v1/token', '?grant_type=refresh_token', `${UPSTREAM}/auth/v1/token?grant_type=refresh_token`],
        ['/sb/storage/v1/object/public/avatars/a%20b.jpg', '', `${UPSTREAM}/storage/v1/object/public/avatars/a%20b.jpg`],
        ['/sb/rest/v1/rpc/get_free_slots_service_day_v2', '', `${UPSTREAM}/rest/v1/rpc/get_free_slots_service_day_v2`],
    ])('%s%s -> project host', (path, search, expected) => {
        expect(resolveUpstreamUrl(path, search, UPSTREAM)?.toString()).toBe(expected);
    });

    test.each([
        '/sb/functions/v1/anything',
        '/sb/realtime/v1/websocket',
        '/sb/pg/query',
        '/sb/rest/v1',
        '/sb/',
        '/sbx/rest/v1/x',
        '/rest/v1/x',
        '/sb/auth/v1/admin/users',
        '/sb/auth/v1/admin',
        '/sb/auth/v1/ADMIN/users',
        '/sb/auth/v1/%61dmin/users',
        '/sb/auth/v1/%41DMIN',
        '/sb/auth/v1/admin;x/users',
        '/sb/auth/v1/admin%3Bx/users',
        '/sb/auth/v1/adminx/users',
        '/sb/auth/v1/admin/',
        '/sb/rest/v1/bookings;x',
        '/sb/rest/v1/../../pg/query',
        '/sb/rest/v1/%2e%2e/%2e%2e/pg',
        '/sb/rest/v1/a%2F..%2F..%2Fpg',
        '/sb/rest/v1/a%5C..',
        '/sb/rest/v1//evil.example/x',
        '/sb/storage/v1/%E0%A4%A',
    ])('refused: %s', (path) => {
        expect(resolveUpstreamUrl(path, '', UPSTREAM)).toBeNull();
    });

    test('an absolute URL or another host in the path never changes the destination', () => {
        const target = resolveUpstreamUrl('/sb/rest/v1/https:/evil.example/x', '?a=https://evil.example', UPSTREAM);
        expect(target?.origin).toBe(UPSTREAM);
    });

    test('Host / X-Forwarded-Host of the request do not reach or steer the upstream', async () => {
        const { fetchMock, response } = call('/sb/rest/v1/services?select=id', {
            headers: { host: 'evil.example', 'x-forwarded-host': 'evil.example', 'x-forwarded-proto': 'http' },
        });
        await response;
        const [target, init] = fetchMock.mock.calls[0];
        expect(String(target)).toBe(`${UPSTREAM}/rest/v1/services?select=id`);
        const sent = init?.headers as Headers;
        expect(sent.get('host')).toBeNull();
        expect(sent.get('x-forwarded-host')).toBeNull();
    });

    test('unknown path with the switch on: 404, nothing sent', async () => {
        const { fetchMock, response } = call('/sb/functions/v1/x');
        expect((await response).status).toBe(404);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe('headers', () => {
    test('only the Supabase client headers are forwarded; cookies and forwarding headers are dropped', () => {
        const source = new Headers({
            apikey: 'anon', authorization: 'Bearer user-jwt', 'content-type': 'application/json', prefer: 'return=representation',
            range: '0-9', 'accept-profile': 'public', 'content-profile': 'public', 'x-client-info': 'supabase-js/2',
            'x-supabase-api-version': '2024-01-01', 'x-upsert': 'true',
            cookie: 'sb-project-ref-auth-token=secret', 'x-forwarded-for': '1.2.3.4', 'x-real-ip': '1.2.3.4',
            'sb-forwarded-for': '1.2.3.4', 'cf-connecting-ip': '1.2.3.4', origin: SITE, referer: `${SITE}/b/x`,
            'x-vercel-id': 'abc', 'accept-encoding': 'br',
        });
        const sent = filterRequestHeaders(source);
        expect(Object.fromEntries(sent.entries())).toEqual({
            apikey: 'anon', authorization: 'Bearer user-jwt', 'content-type': 'application/json', prefer: 'return=representation',
            range: '0-9', 'accept-profile': 'public', 'content-profile': 'public', 'x-client-info': 'supabase-js/2',
            'x-supabase-api-version': '2024-01-01', 'x-upsert': 'true',
        });
    });

    test('private answers are never cacheable and upstream cookies/CORS/encoding are dropped', async () => {
        const upstream = new Response('[{"id":1}]', {
            status: 206,
            headers: {
                'content-type': 'application/json', 'content-range': '0-0/1', 'set-cookie': 'a=b', 'cache-control': 'public, max-age=600',
                'access-control-allow-origin': '*', 'content-encoding': 'gzip', 'x-supabase-api-version': '2024-01-01', server: 'cloudflare',
            },
        });
        const { fetchMock, response } = call('/sb/rest/v1/bookings?select=id', { headers: { apikey: 'anon', authorization: 'Bearer u' } }, ON, upstreamFetch(upstream));
        const res = await response;
        expect(res.status).toBe(206);
        expect(await res.text()).toBe('[{"id":1}]');
        expect(res.headers.get('cache-control')).toBe(PRIVATE_CACHE_CONTROL);
        expect(res.headers.get('cdn-cache-control')).toBe('no-store');
        expect(res.headers.get('vercel-cdn-cache-control')).toBe('no-store');
        expect(res.headers.get('content-range')).toBe('0-0/1');
        expect(res.headers.get('x-supabase-api-version')).toBe('2024-01-01');
        expect(res.headers.get('content-security-policy')).toBe(PROXY_CONTENT_SECURITY_POLICY);
        for (const dropped of ['set-cookie', 'access-control-allow-origin', 'content-encoding', 'server']) {
            expect(res.headers.get(dropped)).toBeNull();
        }
        const init = fetchMock.mock.calls[0][1];
        expect(init?.cache).toBe('no-store');
        expect(init?.redirect).toBe('manual');
    });

    test('auth answers are private even when upstream says public', async () => {
        const upstream = new Response('{"access_token":"t"}', { status: 200, headers: { 'cache-control': 'public, max-age=60' } });
        const { response } = call('/sb/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: '{}' }, ON, upstreamFetch(upstream));
        expect((await response).headers.get('cache-control')).toBe(PRIVATE_CACHE_CONTROL);
    });

    test('only a successful public file read may be cached by the browser, never by the CDN', async () => {
        const ok = await call('/sb/storage/v1/object/public/avatars/1.jpg', {}, ON,
            upstreamFetch(new Response('img', { status: 200, headers: { 'content-type': 'image/jpeg' } }))).response;
        expect(ok.headers.get('cache-control')).toBe(PUBLIC_FILE_CACHE_CONTROL);
        expect(ok.headers.get('vercel-cdn-cache-control')).toBe('no-store');
        expect(ok.headers.get('content-type')).toBe('image/jpeg');
        // An uploaded HTML/SVG "photo" cannot run script on our origin.
        expect(ok.headers.get('content-security-policy')).toBe(PROXY_CONTENT_SECURITY_POLICY);
        const missing = await call('/sb/storage/v1/object/public/avatars/2.jpg', {}, ON,
            upstreamFetch(new Response('{}', { status: 400 }))).response;
        expect(missing.headers.get('cache-control')).toBe(PRIVATE_CACHE_CONTROL);
        const privateFile = await call('/sb/storage/v1/object/authenticated/docs/1.pdf', {}, ON,
            upstreamFetch(new Response('pdf', { status: 200 }))).response;
        expect(privateFile.headers.get('cache-control')).toBe(PRIVATE_CACHE_CONTROL);
    });

    test('a redirect (OAuth authorize) is handed back, not followed', async () => {
        const upstream = new Response(null, { status: 302, headers: { location: 'https://accounts.google.com/o/oauth2/auth?x=1' } });
        const res = await call('/sb/auth/v1/authorize?provider=google', {}, ON, upstreamFetch(upstream)).response;
        expect(res.status).toBe(302);
        expect(res.headers.get('location')).toBe('https://accounts.google.com/o/oauth2/auth?x=1');
    });

    test('204 and HEAD answers carry no body', async () => {
        const noContent = await call('/sb/rest/v1/x?id=eq.1', { method: 'DELETE' }, ON, upstreamFetch(new Response(null, { status: 204 }))).response;
        expect(noContent.status).toBe(204);
        const head = await call('/sb/rest/v1/x', { method: 'HEAD' }, ON, upstreamFetch(new Response(null, { status: 200, headers: { 'content-range': '*/5' } }))).response;
        expect(head.status).toBe(200);
        expect(head.headers.get('content-range')).toBe('*/5');
    });
});

describe('body, methods and failures', () => {
    test('the body and method are passed through', async () => {
        const { fetchMock, response } = call('/sb/rest/v1/staff_schedule_rules', {
            method: 'PATCH', body: '{"is_active":false}', headers: { 'content-type': 'application/json' },
        });
        await response;
        const init = fetchMock.mock.calls[0][1];
        expect(init?.method).toBe('PATCH');
        expect(new TextDecoder().decode(init?.body as ArrayBuffer)).toBe('{"is_active":false}');
    });

    test('a body above the Vercel function limit gets 413 before anything is sent', async () => {
        const big = new Uint8Array(SUPABASE_PROXY_MAX_BODY_BYTES + 1);
        const { fetchMock, response } = call('/sb/storage/v1/object/avatars/x.jpg', { method: 'POST', body: big });
        expect((await response).status).toBe(413);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    test('network failure: 502 without the query string in the log', async () => {
        const fetchMock = jest.fn().mockRejectedValue(new TypeError('fetch failed'));
        const res = await call('/sb/rest/v1/profiles?phone=eq.%2B996555000000', {}, ON, fetchMock as never).response;
        expect(res.status).toBe(502);
        expect(res.headers.get('cache-control')).toBe(PRIVATE_CACHE_CONTROL);
        expect(JSON.stringify((logWarn as jest.Mock).mock.calls)).not.toContain('996');
    });

    test('upstream that never answers: 504 after the bound', async () => {
        const hanging = jest.fn((_url: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
        }));
        const res = await handleSupabaseProxyRequest(new Request(`${SITE}/sb/rest/v1/x`), { env: ON, fetch: hanging as never, timeoutMs: 5 });
        expect(res.status).toBe(504);
    });
});

describe('per-client limit on code sending and checking', () => {
    test('OTP send is counted per client with the Supabase default budget', async () => {
        const { fetchMock, response } = call('/sb/auth/v1/otp', { method: 'POST', body: '{}' });
        expect((await response).status).toBe(200);
        expect(checkRateLimit).toHaveBeenCalledWith(expect.any(Request), SUPABASE_PROXY_AUTH_LIMIT, '/sb/auth/v1/otp');
        expect(fetchMock).toHaveBeenCalled();
    });

    test('over the limit: the same 429 body Supabase Auth returns, nothing sent', async () => {
        (checkRateLimit as jest.Mock).mockResolvedValue({ success: false, limit: 30, remaining: 0, reset: 0, retryAfter: 42 });
        const { fetchMock, response } = call('/sb/auth/v1/verify', { method: 'POST', body: '{}' });
        const res = await response;
        expect(res.status).toBe(429);
        expect(res.headers.get('retry-after')).toBe('42');
        expect(await res.json()).toEqual({ code: 429, error_code: 'over_request_rate_limit', msg: 'Request rate limit reached' });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    test('a limiter that is unavailable does not block sign-in', async () => {
        (checkRateLimit as jest.Mock).mockResolvedValue({ success: false, unavailable: true, limit: 30, remaining: 0, reset: 0 });
        const { fetchMock, response } = call('/sb/auth/v1/otp', { method: 'POST', body: '{}' });
        expect((await response).status).toBe(200);
        expect(fetchMock).toHaveBeenCalled();
    });

    test.each(['refresh_token', 'password', 'id_token'])('token grant %s gets the generous per-client budget', async (grant) => {
        await call(`/sb/auth/v1/token?grant_type=${grant}`, { method: 'POST', body: '{}' }).response;
        expect(checkRateLimit).toHaveBeenCalledWith(expect.any(Request), SUPABASE_PROXY_TOKEN_LIMIT, '/sb/auth/v1/token');
        expect(SUPABASE_PROXY_TOKEN_LIMIT.maxRequests).toBeGreaterThanOrEqual(300);
    });

    test.each([
        ['/sb/auth/v1/OTP', '/sb/auth/v1/otp'],
        ['/sb/auth/v1/otp/', '/sb/auth/v1/otp'],
        ['/sb/auth/v1/%76erify', '/sb/auth/v1/verify'],
        ['/sb/auth/v1/Token/?grant_type=password', '/sb/auth/v1/token'],
    ])('case and trailing-slash variants are counted: %s', async (path, routeId) => {
        await call(path, { method: 'POST', body: '{}' }).response;
        expect(checkRateLimit).toHaveBeenCalledWith(expect.any(Request), expect.anything(), routeId);
    });

    test('data reads and non-POST auth calls are not limited by the proxy', async () => {
        await call('/sb/rest/v1/services').response;
        await call('/sb/auth/v1/user').response;
        expect(checkRateLimit).not.toHaveBeenCalled();
    });

    test('normalized path: decoded, lower case, no trailing slash', () => {
        expect(normalizedProxyPath('/sb/auth/v1/%54oken/')).toBe('/auth/v1/token');
        expect(normalizedProxyPath('/sb/auth/v1/a;b')).toBeNull();
        expect(normalizedProxyPath('/other')).toBeNull();
    });
});
