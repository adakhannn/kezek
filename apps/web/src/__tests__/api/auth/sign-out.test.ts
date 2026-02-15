/**
 * Тесты для /api/auth/sign-out
 * Принудительный выход пользователя
 */

import { POST } from '@/app/api/auth/sign-out/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse } from '../testHelpers';

setupApiTestMocks();

import { createSupabaseClients } from '@/lib/supabaseHelpers';

// Мокаем supabaseHelpers
jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseClients: jest.fn(),
}));

// Мокаем env
jest.mock('@/lib/env', () => ({
    getSupabaseUrl: jest.fn(() => 'https://test.supabase.co'),
}));

describe('/api/auth/sign-out', () => {
    const mockSupabase = createMockSupabase();
    const mockAdmin = createMockSupabase();

    beforeEach(() => {
        jest.clearAllMocks();

        (createSupabaseClients as jest.Mock).mockResolvedValue({
            supabase: mockSupabase,
            admin: mockAdmin,
        });
    });

    describe('Успешный выход', () => {
        test('должен успешно выйти пользователя и инвалидировать токены', async () => {
            // Пользователь авторизован
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: 'user-id',
                        email: 'test@example.com',
                    },
                },
                error: null,
            });

            // Мокаем invalidateRefreshTokens
            const mockInvalidateRefreshTokens = jest.fn().mockResolvedValue(undefined);
            (mockAdmin.auth.admin as { invalidateRefreshTokens?: jest.Mock }).invalidateRefreshTokens = mockInvalidateRefreshTokens;

            const req = createMockRequest('http://localhost/api/auth/sign-out', {
                method: 'POST',
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('message', 'Выход выполнен');
            expect(mockSupabase.auth.getUser).toHaveBeenCalled();
            expect(mockInvalidateRefreshTokens).toHaveBeenCalledWith('user-id');
        });

        test('должен успешно выйти даже если пользователь не авторизован', async () => {
            // Пользователь не авторизован
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: null,
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/auth/sign-out', {
                method: 'POST',
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('message', 'Выход выполнен');
        });

        test('должен обработать ошибку при инвалидации токенов', async () => {
            // Пользователь авторизован
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: 'user-id',
                        email: 'test@example.com',
                    },
                },
                error: null,
            });

            // Мокаем invalidateRefreshTokens с ошибкой
            const mockInvalidateRefreshTokens = jest.fn().mockRejectedValue(new Error('Token invalidation failed'));
            (mockAdmin.auth.admin as { invalidateRefreshTokens?: jest.Mock }).invalidateRefreshTokens = mockInvalidateRefreshTokens;

            const req = createMockRequest('http://localhost/api/auth/sign-out', {
                method: 'POST',
            });

            // Должен все равно вернуть успех, даже если инвалидация токенов не удалась
            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('message', 'Выход выполнен');
            expect(mockInvalidateRefreshTokens).toHaveBeenCalledWith('user-id');
        });

        test('должен обработать случай когда invalidateRefreshTokens не доступен', async () => {
            // Пользователь авторизован
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: 'user-id',
                        email: 'test@example.com',
                    },
                },
                error: null,
            });

            // invalidateRefreshTokens не определен
            (mockAdmin.auth.admin as { invalidateRefreshTokens?: jest.Mock }).invalidateRefreshTokens = undefined;

            const req = createMockRequest('http://localhost/api/auth/sign-out', {
                method: 'POST',
            });

            // Должен все равно вернуть успех
            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('message', 'Выход выполнен');
        });
    });

    describe('Очистка cookies', () => {
        test('должен удалить cookies Supabase', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: null,
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/auth/sign-out', {
                method: 'POST',
            });

            const res = await POST(req);
            
            // Проверяем, что cookies были установлены для удаления
            expect(res.headers.get('set-cookie')).toBeTruthy();
        });
    });
});

