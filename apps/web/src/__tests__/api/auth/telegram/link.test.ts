/**
 * Тесты для /api/auth/telegram/link
 * Привязка Telegram аккаунта
 */

import { POST } from '@/app/api/auth/telegram/link/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../testHelpers';

setupApiTestMocks();

import { createSupabaseClients } from '@/lib/supabaseHelpers';
import { verifyTelegramAuth, normalizeTelegramData } from '@/lib/telegram/verify';

// Мокаем зависимости
jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseClients: jest.fn(),
}));

jest.mock('@/lib/telegram/verify', () => ({
    verifyTelegramAuth: jest.fn(),
    normalizeTelegramData: jest.fn(),
}));

describe('/api/auth/telegram/link', () => {
    const mockSupabase = createMockSupabase();
    const mockAdmin = createMockSupabase();

    beforeEach(() => {
        jest.clearAllMocks();

        (createSupabaseClients as jest.Mock).mockResolvedValue({
            supabase: mockSupabase,
            admin: mockAdmin,
        });
    });

    describe('Авторизация', () => {
        test('должен вернуть 401 если пользователь не авторизован', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: null,
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/auth/telegram/link', {
                method: 'POST',
                body: {
                    id: 123456789,
                    hash: 'valid-hash',
                    auth_date: Date.now(),
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 401);
        });
    });

    describe('Валидация', () => {
        test('должен вернуть 400 при отсутствии обязательных полей', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: 'user-id',
                    },
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/auth/telegram/link', {
                method: 'POST',
                body: {},
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400);
        });

        test('должен вернуть 400 при неверной подписи Telegram', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: 'user-id',
                    },
                },
                error: null,
            });

            (verifyTelegramAuth as jest.Mock).mockReturnValue(false);

            const req = createMockRequest('http://localhost/api/auth/telegram/link', {
                method: 'POST',
                body: {
                    id: 123456789,
                    hash: 'invalid-hash',
                    auth_date: Date.now(),
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400);
        });
    });

    describe('Успешная привязка', () => {
        test('должен успешно привязать Telegram аккаунт', async () => {
            const userId = 'user-id';
            const telegramId = 123456789;

            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: userId,
                    },
                },
                error: null,
            });

            (verifyTelegramAuth as jest.Mock).mockReturnValue(true);
            (normalizeTelegramData as jest.Mock).mockReturnValue({
                telegram_id: telegramId,
                full_name: 'Test User',
                telegram_username: 'testuser',
                telegram_photo_url: null,
            });

            // Мокаем проверку существующего профиля (не найден)
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            // Мокаем обновление профиля
            mockAdmin.from.mockReturnValueOnce({
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/auth/telegram/link', {
                method: 'POST',
                body: {
                    id: telegramId,
                    hash: 'valid-hash',
                    auth_date: Date.now(),
                },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
        });

        test('должен вернуть 400 если Telegram аккаунт уже привязан к другому пользователю', async () => {
            const userId = 'user-id';
            const telegramId = 123456789;

            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: userId,
                    },
                },
                error: null,
            });

            (verifyTelegramAuth as jest.Mock).mockReturnValue(true);
            (normalizeTelegramData as jest.Mock).mockReturnValue({
                telegram_id: telegramId,
                full_name: 'Test User',
                telegram_username: 'testuser',
                telegram_photo_url: null,
            });

            // Мокаем проверку существующего профиля (найден другой пользователь)
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: 'other-user-id', // Другой пользователь
                        telegram_id: telegramId,
                    },
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/auth/telegram/link', {
                method: 'POST',
                body: {
                    id: telegramId,
                    hash: 'valid-hash',
                    auth_date: Date.now(),
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400);
        });
    });
});


