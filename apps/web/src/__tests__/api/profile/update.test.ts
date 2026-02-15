/**
 * Тесты для /api/profile/update
 * Обновление профиля пользователя
 */

import { POST } from '@/app/api/profile/update/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../testHelpers';

setupApiTestMocks();

import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

// Мокаем supabaseHelpers
jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseServerClient: jest.fn(),
}));

describe('/api/profile/update', () => {
    const mockSupabase = createMockSupabase();

    beforeEach(() => {
        jest.clearAllMocks();

        (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabase);
    });

    describe('Авторизация', () => {
        test('должен вернуть 401 если пользователь не авторизован', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: null,
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/profile/update', {
                method: 'POST',
                body: {
                    full_name: 'Test User',
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 401);
        });
    });

    describe('Успешное обновление', () => {
        test('должен успешно обновить профиль', async () => {
            const userId = 'user-id';

            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: userId,
                        user_metadata: {},
                    },
                },
                error: null,
            });

            // Мокаем получение текущего профиля
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        phone: '+996555123456',
                        whatsapp_verified: true,
                    },
                    error: null,
                }),
            });

            // Мокаем обновление профиля
            mockSupabase.from.mockReturnValueOnce({
                upsert: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            // Мокаем обновление user_metadata
            mockSupabase.auth.updateUser.mockResolvedValue({
                data: {
                    user: {
                        id: userId,
                    },
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/profile/update', {
                method: 'POST',
                body: {
                    full_name: 'Updated Name',
                    phone: '+996555123456',
                    notify_email: true,
                    notify_sms: true,
                    notify_whatsapp: true,
                    notify_telegram: true,
                },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
        });

        test('должен сбросить whatsapp_verified при изменении телефона', async () => {
            const userId = 'user-id';

            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: userId,
                        user_metadata: {},
                    },
                },
                error: null,
            });

            // Мокаем получение текущего профиля
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        phone: '+996555123456',
                        whatsapp_verified: true,
                    },
                    error: null,
                }),
            });

            // Мокаем обновление профиля (whatsapp_verified должен быть false)
            mockSupabase.from.mockReturnValueOnce({
                upsert: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            mockSupabase.auth.updateUser.mockResolvedValue({
                data: {
                    user: {
                        id: userId,
                    },
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/profile/update', {
                method: 'POST',
                body: {
                    full_name: 'Updated Name',
                    phone: '+996555999999', // Новый номер телефона
                },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
        });

        test('должен обработать telegram_id из user_metadata', async () => {
            const userId = 'user-id';
            const telegramId = 123456789;

            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: userId,
                        user_metadata: {
                            telegram_id: telegramId,
                        },
                    },
                },
                error: null,
            });

            // Мокаем получение текущего профиля
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        phone: '+996555123456',
                        whatsapp_verified: false,
                    },
                    error: null,
                }),
            });

            // Мокаем обновление профиля (должен включить telegram_id и telegram_verified)
            mockSupabase.from.mockReturnValueOnce({
                upsert: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            mockSupabase.auth.updateUser.mockResolvedValue({
                data: {
                    user: {
                        id: userId,
                    },
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/profile/update', {
                method: 'POST',
                body: {
                    full_name: 'Updated Name',
                },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
        });
    });
});

