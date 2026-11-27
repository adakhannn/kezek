import { SUPABASE_PROXY_STATUS_HEADER } from '@shared-client/supabaseProxy';

import { createSupabaseFetch } from '../../lib/supabaseFetch';
import {
    appSupabaseProxyConfig,
    appSupabaseProxyFetch,
    displayStorageUrl,
    resetSupabaseProxyCacheForTests,
} from '../../lib/supabaseProxy';

const SUPABASE = 'https://project-ref.supabase.co';
const PROXY = 'https://kezek.vercel.app/sb';
const PROXY_ENV = 'EXPO_PUBLIC_SUPABASE_PROXY_URL';
const URL_ENV = 'EXPO_PUBLIC_SUPABASE_URL';
const saved = { proxy: process.env[PROXY_ENV], url: process.env[URL_ENV] };

function restore(name: string, value: string | undefined) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
}

afterEach(() => {
    restore(PROXY_ENV, saved.proxy);
    restore(URL_ENV, saved.url);
    resetSupabaseProxyCacheForTests();
});

describe('app Supabase proxy (R25-31)', () => {
    test('unset: off, the client keeps its direct fetch and photos are untouched', () => {
        delete process.env[PROXY_ENV];
        process.env[URL_ENV] = SUPABASE;
        expect(appSupabaseProxyConfig()).toBeNull();
        expect(appSupabaseProxyFetch()).toBeNull();
        const photo = `${SUPABASE}/storage/v1/object/public/avatars/1.jpg`;
        expect(displayStorageUrl(photo)).toBe(photo);
    });

    test('a relative proxy URL is ignored in the app (no origin to resolve it)', () => {
        expect(appSupabaseProxyConfig(SUPABASE, '/sb')).toBeNull();
    });

    test('set: photos of the project go through the proxy, others do not', () => {
        process.env[PROXY_ENV] = PROXY;
        process.env[URL_ENV] = SUPABASE;
        expect(displayStorageUrl(`${SUPABASE}/storage/v1/object/public/avatars/1.jpg`))
            .toBe(`${PROXY}/storage/v1/object/public/avatars/1.jpg`);
        expect(displayStorageUrl('https://t.me/i/userpic/1.jpg')).toBe('https://t.me/i/userpic/1.jpg');
        expect(displayStorageUrl(null)).toBeNull();
    });

    test('set: requests are rewritten inside the timeout-bounded fetch, the client URL stays the same', async () => {
        const base = jest.fn().mockResolvedValue(new Response('{}'));
        const proxyFetch = appSupabaseProxyFetch(appSupabaseProxyConfig(SUPABASE, PROXY))!;
        const realFetch = global.fetch;
        global.fetch = base as unknown as typeof fetch;
        try {
            await createSupabaseFetch(20_000, proxyFetch)(`${SUPABASE}/auth/v1/token?grant_type=refresh_token`, { method: 'POST' });
        } finally {
            global.fetch = realFetch;
        }
        expect(base.mock.calls[0][0]).toBe(`${PROXY}/auth/v1/token?grant_type=refresh_token`);
        expect(base.mock.calls[0][1].signal).toBeDefined();
    });

    test('server proxy switched off: falls back to the direct address', async () => {
        const base = jest.fn()
            .mockResolvedValueOnce(new Response(null, { status: 404, headers: { [SUPABASE_PROXY_STATUS_HEADER]: 'disabled' } }))
            .mockResolvedValue(new Response('{}'));
        const realFetch = global.fetch;
        global.fetch = base as unknown as typeof fetch;
        try {
            const proxyFetch = appSupabaseProxyFetch(appSupabaseProxyConfig(SUPABASE, PROXY))!;
            const res = await proxyFetch(`${SUPABASE}/rest/v1/services`);
            expect(res.status).toBe(200);
        } finally {
            global.fetch = realFetch;
        }
        expect(base.mock.calls.map(([url]) => url)).toEqual([`${PROXY}/rest/v1/services`, `${SUPABASE}/rest/v1/services`]);
    });
});
