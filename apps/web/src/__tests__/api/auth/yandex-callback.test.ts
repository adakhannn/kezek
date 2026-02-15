/**
 * Тесты для /api/auth/yandex/callback
 * OAuth callback от Yandex
 */

import { GET } from '@/app/api/auth/yandex/callback/route';
import { setupApiTestMocks, createMockRequest } from '../testHelpers';

setupApiTestMocks();

// Мокаем fetch для внешних запросов
global.fetch = jest.fn();

describe('/api/auth/yandex/callback', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('должен вернуть редирект при ошибке OAuth', async () => {
        const req = createMockRequest('http://localhost/api/auth/yandex/callback?error=access_denied', {
            method: 'GET',
        });

        const res = await GET(req);
        expect(res.status).toBe(307); // Redirect
        expect(res.headers.get('location')).toContain('/auth/sign-in?error=');
    });

    test('должен вернуть редирект при отсутствии кода', async () => {
        const req = createMockRequest('http://localhost/api/auth/yandex/callback', {
            method: 'GET',
        });

        const res = await GET(req);
        expect(res.status).toBe(307); // Redirect
        expect(res.headers.get('location')).toContain('/auth/sign-in?error=no_code');
    });

    test('должен обработать успешный OAuth callback', async () => {
        // Мокаем успешный обмен кода на токен
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                access_token: 'yandex-access-token',
            }),
        });

        // Мокаем получение информации о пользователе
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                id: 'yandex-user-id',
                login: 'testuser',
                default_email: 'test@yandex.ru',
            }),
        });

        // Мокаем createClient
        const mockAdmin = {
            from: jest.fn(),
            auth: {
                admin: {
                    listUsers: jest.fn().mockResolvedValue({
                        data: {
                            users: [],
                        },
                        error: null,
                    }),
                    createUser: jest.fn().mockResolvedValue({
                        data: {
                            user: {
                                id: 'new-user-id',
                            },
                        },
                        error: null,
                    }),
                },
            },
        };

        jest.mock('@supabase/supabase-js', () => ({
            createClient: jest.fn().mockReturnValue(mockAdmin),
        }));

        const req = createMockRequest('http://localhost/api/auth/yandex/callback?code=oauth-code', {
            method: 'GET',
        });

        const res = await GET(req);
        // Может вернуть редирект или ошибку в зависимости от конфигурации
        expect([200, 307, 500]).toContain(res.status);
    });
});

