import {
    createSupabaseProxyFetch,
    resolveSupabaseProxyConfig,
    toProxiedSupabaseUrl,
} from '@shared-client/supabaseProxy';

import { browserSupabaseClientOptions, browserSupabaseProxyConfig, displayAvatarUrl } from '@/lib/supabaseProxyClient';

const SUPABASE = 'https://project-ref.supabase.co';
const SITE = 'https://kezek.vercel.app';
const config = resolveSupabaseProxyConfig(SUPABASE, `${SITE}/sb/`)!;

function okFetch() {
    return jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit | undefined]>().mockResolvedValue(new Response('{}'));
}

describe('proxy configuration', () => {
    test('off when the proxy URL is unset, blank or invalid', () => {
        expect(resolveSupabaseProxyConfig(SUPABASE, undefined)).toBeNull();
        expect(resolveSupabaseProxyConfig(SUPABASE, '  ')).toBeNull();
        expect(resolveSupabaseProxyConfig(SUPABASE, 'ftp://x/sb')).toBeNull();
        expect(resolveSupabaseProxyConfig(SUPABASE, `${SITE}/sb?x=1`)).toBeNull();
        expect(resolveSupabaseProxyConfig(SUPABASE, SUPABASE)).toBeNull();
        expect(resolveSupabaseProxyConfig(undefined, `${SITE}/sb`)).toBeNull();
    });

    test('a relative proxy URL needs the page origin (off in server rendering)', () => {
        expect(resolveSupabaseProxyConfig(SUPABASE, '/sb', null)).toBeNull();
        expect(resolveSupabaseProxyConfig(SUPABASE, '/sb', SITE)).toEqual({ supabaseOrigin: SUPABASE, proxyBase: `${SITE}/sb` });
        expect(resolveSupabaseProxyConfig(SUPABASE, '//evil.example/sb', SITE)).toBeNull();
    });

    test('browser config reads NEXT_PUBLIC_SUPABASE_PROXY_URL; unset in this test run means off', () => {
        expect(process.env.NEXT_PUBLIC_SUPABASE_PROXY_URL).toBeUndefined();
        expect(browserSupabaseProxyConfig()).toBeNull();
        expect(browserSupabaseClientOptions()).toBeUndefined();
        expect(browserSupabaseProxyConfig(SUPABASE, '/sb', SITE)).toEqual({ supabaseOrigin: SUPABASE, proxyBase: `${SITE}/sb` });
        expect(typeof browserSupabaseClientOptions(config)?.global.fetch).toBe('function');
    });
});

describe('URL rewrite', () => {
    test.each([
        [`${SUPABASE}/rest/v1/bookings?select=*`, `${SITE}/sb/rest/v1/bookings?select=*`],
        [`${SUPABASE}/auth/v1/token?grant_type=refresh_token`, `${SITE}/sb/auth/v1/token?grant_type=refresh_token`],
        [`${SUPABASE}/storage/v1/object/public/avatars/1.jpg`, `${SITE}/sb/storage/v1/object/public/avatars/1.jpg`],
    ])('%s -> proxy', (from, to) => {
        expect(toProxiedSupabaseUrl(from, config)).toBe(to);
    });

    test.each([
        `${SUPABASE}/functions/v1/x`,
        `${SUPABASE}.evil.example/rest/v1/x`,
        'https://other.supabase.co/rest/v1/x',
        `${SITE}/api/x`,
        'https://t.me/i/userpic/1.jpg',
    ])('unchanged: %s', (url) => {
        expect(toProxiedSupabaseUrl(url, config)).toBe(url);
    });

    test('proxy off: every URL unchanged', () => {
        expect(toProxiedSupabaseUrl(`${SUPABASE}/rest/v1/x`, null)).toBe(`${SUPABASE}/rest/v1/x`);
    });
});

describe('createSupabaseProxyFetch', () => {
    test('proxy off: the base fetch itself, untouched', () => {
        const base = okFetch() as unknown as typeof fetch;
        expect(createSupabaseProxyFetch(null, base)).toBe(base);
    });

    test('Supabase requests go to the proxy with the same init; others stay direct', async () => {
        const base = okFetch();
        const proxied = createSupabaseProxyFetch(config, base as unknown as typeof fetch);
        const init = { method: 'POST', headers: { apikey: 'anon' }, body: '{}' };
        await proxied(`${SUPABASE}/auth/v1/otp`, init);
        await proxied(new URL(`${SUPABASE}/rest/v1/x`));
        await proxied(`${SUPABASE}/functions/v1/f`);
        expect(base.mock.calls[0]).toEqual([`${SITE}/sb/auth/v1/otp`, init]);
        expect(base.mock.calls[1][0]).toBe(`${SITE}/sb/rest/v1/x`);
        expect(base.mock.calls[2][0]).toBe(`${SUPABASE}/functions/v1/f`);
    });

    test('server says the proxy is off: this and later requests go direct', async () => {
        const base = okFetch();
        base.mockResolvedValueOnce(new Response(null, { status: 404, headers: { 'x-kezek-sb-proxy': 'disabled' } }));
        const proxied = createSupabaseProxyFetch(config, base as unknown as typeof fetch);
        const res = await proxied(`${SUPABASE}/auth/v1/otp`, { method: 'POST', body: '{}' });
        expect(res.status).toBe(200);
        await proxied(`${SUPABASE}/rest/v1/x`);
        expect(base.mock.calls.map(([url]) => url)).toEqual([
            `${SITE}/sb/auth/v1/otp`, `${SUPABASE}/auth/v1/otp`, `${SUPABASE}/rest/v1/x`,
        ]);
    });

    test('a plain 404 from Supabase is returned as is', async () => {
        const base = okFetch();
        base.mockResolvedValueOnce(new Response('{}', { status: 404 }));
        const res = await createSupabaseProxyFetch(config, base as unknown as typeof fetch)(`${SUPABASE}/rest/v1/missing`);
        expect(res.status).toBe(404);
        expect(base).toHaveBeenCalledTimes(1);
    });

    test('network failure: a read is retried direct once, a write is not repeated', async () => {
        const base = okFetch();
        base.mockRejectedValueOnce(new TypeError('Network request failed'));
        const proxied = createSupabaseProxyFetch(config, base as unknown as typeof fetch);
        expect((await proxied(`${SUPABASE}/rest/v1/x`)).status).toBe(200);
        expect(base.mock.calls[1][0]).toBe(`${SUPABASE}/rest/v1/x`);

        base.mockRejectedValueOnce(new TypeError('Network request failed'));
        await expect(proxied(`${SUPABASE}/rest/v1/x`, { method: 'POST', body: '{}' })).rejects.toThrow('Network request failed');
        expect(base).toHaveBeenCalledTimes(3);
    });

    test('a caller abort (timeout) is not retried', async () => {
        const base = okFetch();
        base.mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        await expect(createSupabaseProxyFetch(config, base as unknown as typeof fetch)(`${SUPABASE}/rest/v1/x`)).rejects.toThrow('aborted');
        expect(base).toHaveBeenCalledTimes(1);
    });
});

describe('displayAvatarUrl', () => {
    const photo = `${SUPABASE}/storage/v1/object/public/avatars/staff/1.jpg`;

    test('proxy off (this test run): the stored URL unchanged', () => {
        expect(displayAvatarUrl(photo)).toBe(photo);
        expect(displayAvatarUrl(null)).toBeNull();
    });

    test('relative proxy URL: a same-origin path, also in server rendering', () => {
        expect(displayAvatarUrl(photo, SUPABASE, '/sb')).toBe('/sb/storage/v1/object/public/avatars/staff/1.jpg');
    });

    test('absolute proxy URL: the proxy address', () => {
        expect(displayAvatarUrl(photo, SUPABASE, `${SITE}/sb`)).toBe(`${SITE}/sb/storage/v1/object/public/avatars/staff/1.jpg`);
    });

    test('photos elsewhere and local previews are untouched', () => {
        expect(displayAvatarUrl('blob:https://kezek.vercel.app/1', SUPABASE, '/sb')).toBe('blob:https://kezek.vercel.app/1');
        expect(displayAvatarUrl('https://t.me/i/userpic/1.jpg', SUPABASE, '/sb')).toBe('https://t.me/i/userpic/1.jpg');
    });
});
