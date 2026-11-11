jest.mock('@/lib/yandexOAuthConfig', () => ({
    getYandexPublicOrigin: () => 'https://example.invalid',
    getYandexCallbackUrl: () => 'https://example.invalid/auth/callback-yandex',
    getYandexOAuthCredentials: () => ({ clientId: 'test-client', clientSecret: 'test-secret' }),
}));
jest.mock('@/lib/yandexOAuthState', () => ({ createYandexOAuthState: jest.fn() }));
jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseServerClient: jest.fn() }));
jest.mock('@/lib/rateLimit', () => ({ withRateLimit: (_req: Request, _config: unknown, handler: () => Promise<Response>) => handler(), RateLimitConfigs: { auth: {} } }));

import { GET } from '@/app/api/auth/yandex/start/route';
import { POST } from '@/app/api/auth/yandex/link/start/route';
import { createYandexOAuthState } from '@/lib/yandexOAuthState';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

describe('Yandex state issuance', () => {
    beforeEach(() => {
        jest.resetAllMocks();
        jest.mocked(createYandexOAuthState).mockResolvedValue('a'.repeat(64));
        jest.mocked(createSupabaseServerClient).mockResolvedValue({ auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'caller' } }, error: null }) } } as never);
    });
    test('persists a sign-in attempt before redirect and sets a protected cookie', async () => {
        const response = await GET(new Request('https://example.invalid/api/auth/yandex/start?redirect=%2Fcabinet'));
        expect(createYandexOAuthState).toHaveBeenCalledWith('sign_in', null, '/cabinet');
        expect(response.headers.get('location')).toContain('state=' + 'a'.repeat(64));
        expect(response.headers.get('set-cookie')).toContain('HttpOnly');
        expect(response.headers.get('set-cookie')).toContain('SameSite=lax');
        expect(response.headers.get('set-cookie')).toContain('Max-Age=600');
    });
    test('binds link issuance to the authenticated identity', async () => {
        const response = await POST(new Request('https://example.invalid/api/auth/yandex/link/start', { method: 'POST' }));
        expect(response.status).toBe(200);
        expect(createYandexOAuthState).toHaveBeenCalledWith('link', 'caller', '/profile');
        expect(response.headers.get('set-cookie')).toContain('kezek_yandex_link_state');
    });
    test('does not issue a link attempt for a missing session', async () => {
        jest.mocked(createSupabaseServerClient).mockResolvedValue({ auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) } } as never);
        expect((await POST(new Request('https://example.invalid/api/auth/yandex/link/start', { method: 'POST' }))).status).toBe(401);
        expect(createYandexOAuthState).not.toHaveBeenCalled();
    });
    test('fails closed when persistence is unavailable', async () => {
        jest.mocked(createYandexOAuthState).mockRejectedValue(new Error('missing migration'));
        const signIn = await GET(new Request('https://example.invalid/api/auth/yandex/start'));
        expect(signIn.headers.get('location')).toContain('error=yandex_unavailable');
        expect(signIn.headers.get('set-cookie')).toBeNull();
        const link = await POST(new Request('https://example.invalid/api/auth/yandex/link/start', { method: 'POST' }));
        expect(link.status).toBe(503);
        expect(link.headers.get('set-cookie')).toBeNull();
    });
});
