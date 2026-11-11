jest.mock('@/lib/yandexAuthCallbackRouteService', () => ({
    runYandexAuthCallbackRoute: jest.fn(),
}));
jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseServerClient: jest.fn() }));
jest.mock('@/lib/yandexOAuthState', () => ({ consumeYandexOAuthState: jest.fn() }));
jest.mock('@/lib/yandexOAuthConfig', () => ({ getYandexPublicOrigin: () => 'https://example.invalid' }));

import { runYandexAuthCallbackRoute } from '@/lib/yandexAuthCallbackRouteService';
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { consumeYandexOAuthState } from '@/lib/yandexOAuthState';
import { runYandexAuthCallbackHttp } from '@/lib/yandexAuthCallbackHttpService';

describe('yandexAuthCallbackHttpService', () => {
    const state = 'a'.repeat(64);
    const cookieValues = new Map<string, string>();
    const request = (query = `state=${state}&code=code`) => new Request(`https://example.invalid/api/auth/yandex/callback?${query}`);
    beforeEach(() => {
        jest.resetAllMocks();
        cookieValues.clear();
        cookieValues.set('kezek_yandex_sign_in_state', state);
        jest.mocked(cookies).mockResolvedValue({ get: (name: string) => ({ value: cookieValues.get(name) }) } as never);
        jest.mocked(consumeYandexOAuthState).mockResolvedValue({ returnPath: '/cabinet' });
        jest.mocked(runYandexAuthCallbackRoute).mockResolvedValue({ ok: true, redirectUrl: 'https://example.invalid/auth/callback' });
    });

    test('consumes the browser-bound state before exchange and trusts only the saved return path', async () => {
        const response = await runYandexAuthCallbackHttp(request(`state=${state}&code=code&redirect=https://attacker.invalid`));
        expect(consumeYandexOAuthState).toHaveBeenCalledWith(state, 'sign_in', null);
        expect(jest.mocked(consumeYandexOAuthState).mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(runYandexAuthCallbackRoute).mock.invocationCallOrder[0]);
        const input = jest.mocked(runYandexAuthCallbackRoute).mock.calls[0][0];
        expect(new URL(input.requestUrl).searchParams.get('redirect')).toBe('/cabinet');
        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe('https://example.invalid/auth/callback');
        expect(response.cookies.get('kezek_yandex_sign_in_state')?.value).toBe('');
    });

    test.each(['code=code', `code=code&state=${'b'.repeat(64)}`, 'code=code&state=malformed'])('rejects missing/foreign/malformed state without exchange: %s', async query => {
        const response = await runYandexAuthCallbackHttp(request(query));
        expect(response.headers.get('location')).toContain('error=yandex_state');
        expect(consumeYandexOAuthState).not.toHaveBeenCalled();
        expect(runYandexAuthCallbackRoute).not.toHaveBeenCalled();
    });

    test('rejects an expired or already consumed state even when the browser cookie matches', async () => {
        jest.mocked(consumeYandexOAuthState).mockResolvedValue(null);
        const response = await runYandexAuthCallbackHttp(request());
        expect(response.headers.get('location')).toContain('error=yandex_state');
        expect(runYandexAuthCallbackRoute).not.toHaveBeenCalled();
    });

    test('binds a link attempt to the currently authenticated user', async () => {
        cookieValues.set('kezek_yandex_link_state', state);
        jest.mocked(createSupabaseServerClient).mockResolvedValue({ auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'caller' } }, error: null }) } } as never);
        await runYandexAuthCallbackHttp(request());
        expect(consumeYandexOAuthState).toHaveBeenCalledWith(state, 'link', 'caller');
        expect(runYandexAuthCallbackRoute).toHaveBeenCalledWith(expect.objectContaining({ linkUserId: 'caller' }));
    });

    test('does not link without a verified session', async () => {
        cookieValues.set('kezek_yandex_link_state', state);
        jest.mocked(createSupabaseServerClient).mockResolvedValue({ auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) } } as never);
        const response = await runYandexAuthCallbackHttp(request());
        expect(response.headers.get('location')).toContain('error=session_required');
        expect(consumeYandexOAuthState).not.toHaveBeenCalled();
        expect(runYandexAuthCallbackRoute).not.toHaveBeenCalled();
    });

    test('does not exchange when state storage is unavailable', async () => {
        jest.mocked(consumeYandexOAuthState).mockRejectedValue(new Error('storage failed'));
        const response = await runYandexAuthCallbackHttp(request());
        expect(response.headers.get('location')).toContain('error=yandex_unavailable');
        expect(runYandexAuthCallbackRoute).not.toHaveBeenCalled();
    });

    test('a second callback cannot reuse a consumed attempt', async () => {
        jest.mocked(consumeYandexOAuthState).mockResolvedValueOnce({ returnPath: '/' }).mockResolvedValueOnce(null);
        await runYandexAuthCallbackHttp(request());
        const replay = await runYandexAuthCallbackHttp(request());
        expect(replay.headers.get('location')).toContain('error=yandex_state');
        expect(runYandexAuthCallbackRoute).toHaveBeenCalledTimes(1);
    });
});
