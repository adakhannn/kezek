import { runYandexAuthCallbackRoute } from '@/lib/yandexAuthCallbackRouteService';

jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(),
}));

jest.mock('@/lib/yandexAuthCallbackService', () => ({
    runYandexOAuthCallback: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';
import { runYandexOAuthCallback } from '@/lib/yandexAuthCallbackService';

describe('yandexAuthCallbackRouteService', () => {
    const admin = { auth: { admin: {}, signInWithPassword: jest.fn() }, from: jest.fn() };

    beforeEach(() => {
        jest.clearAllMocks();
        (createClient as jest.Mock).mockReturnValue(admin);
    });

    test('returns redirect when oauth error is present', async () => {
        const result = await runYandexAuthCallbackRoute({
            requestUrl: 'http://localhost/api/auth/yandex/callback?error=access_denied',
            env: {},
        });

        expect(result).toEqual({
            ok: false,
            redirectUrl: 'https://kezek.kg/auth/sign-in?error=access_denied',
        });
    });

    test('returns redirect when code is missing', async () => {
        const result = await runYandexAuthCallbackRoute({
            requestUrl: 'http://localhost/api/auth/yandex/callback',
            env: {},
        });

        expect(result).toEqual({
            ok: false,
            redirectUrl: 'https://kezek.kg/auth/sign-in?error=no_code',
        });
    });

    test('exchanges code, loads user info and delegates to yandex oauth service', async () => {
        const fetchImpl = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    access_token: 'yandex-access-token',
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    id: 'yandex-user-id',
                    login: 'testuser',
                    default_email: 'test@yandex.ru',
                }),
            });

        (runYandexOAuthCallback as jest.Mock).mockResolvedValue({
            redirectUrl: 'https://kezek.kg/auth/callback#token',
        });

        const result = await runYandexAuthCallbackRoute({
            requestUrl: 'http://localhost/api/auth/yandex/callback?code=oauth-code',
            env: {
                NEXT_PUBLIC_SITE_ORIGIN: 'http://localhost',
                YANDEX_OAUTH_CLIENT_ID: 'client-id',
                YANDEX_OAUTH_CLIENT_SECRET: 'client-secret',
                NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
                SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
            },
            fetchImpl: fetchImpl as never,
        });

        expect(createClient).toHaveBeenCalledWith(
            'http://localhost:54321',
            'service-role-key',
        );
        expect(runYandexOAuthCallback).toHaveBeenCalledWith(
            expect.objectContaining({
                admin,
                origin: 'http://localhost',
                redirectTo: '/',
            }),
        );
        expect(result).toEqual({
            ok: true,
            redirectUrl: 'https://kezek.kg/auth/callback#token',
        });
    });
});
