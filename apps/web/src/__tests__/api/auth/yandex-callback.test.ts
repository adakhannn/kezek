jest.mock('@/lib/yandexOAuthConfig', () => ({ getYandexPublicOrigin: () => 'https://example.invalid' }));
jest.mock('@/lib/yandexOAuthState', () => ({ consumeYandexOAuthState: jest.fn() }));
jest.mock('@/lib/yandexAuthCallbackRouteService', () => ({ runYandexAuthCallbackRoute: jest.fn() }));
jest.mock('next/headers', () => ({ cookies: jest.fn() }));
import { GET } from '@/app/api/auth/yandex/callback/route';
import { cookies } from 'next/headers';
import { consumeYandexOAuthState } from '@/lib/yandexOAuthState';
import { runYandexAuthCallbackRoute } from '@/lib/yandexAuthCallbackRouteService';

describe('Yandex callback route state boundary', () => {
    beforeEach(() => { jest.resetAllMocks(); });
    test('rejects an OAuth code without an initiated browser attempt', async () => {
        const response = await GET(new Request('https://example.invalid/api/auth/yandex/callback?code=attacker-code'));
        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toContain('error=yandex_state');
        expect(runYandexAuthCallbackRoute).not.toHaveBeenCalled();
        expect(global.fetch).not.toHaveBeenCalled();
    });
    test('allows exchange only after matching cookie and atomic state consumption', async () => {
        const state = 'a'.repeat(64);
        jest.mocked(cookies).mockResolvedValue({ get: (name: string) => name === 'kezek_yandex_sign_in_state' ? { value: state } : undefined } as never);
        jest.mocked(consumeYandexOAuthState).mockResolvedValue({ returnPath: '/cabinet' });
        jest.mocked(runYandexAuthCallbackRoute).mockResolvedValue({ ok: true, redirectUrl: 'https://example.invalid/auth/callback' });
        const response = await GET(new Request('https://example.invalid/api/auth/yandex/callback?code=verified-code&state=' + state));
        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe('https://example.invalid/auth/callback');
        expect(consumeYandexOAuthState).toHaveBeenCalledWith(state, 'sign_in', null);
        expect(runYandexAuthCallbackRoute).toHaveBeenCalledTimes(1);
    });
});
