/**
 * Тесты для /api/whatsapp/verify-otp
 * Проверка OTP кода и подтверждение WhatsApp номера
 */

import { POST } from '@/app/api/whatsapp/verify-otp/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../../testHelpers';

setupApiTestMocks();

import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

// Мокаем зависимости
jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseServerClient: jest.fn(),
}));

jest.mock('@/lib/rateLimit', () => ({
    withRateLimit: jest.fn((req, config, handler) => handler()),
    RateLimitConfigs: {
        auth: {},
    },
}));

describe('/api/whatsapp/verify-otp', () => {
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

            const req = createMockRequest('http://localhost/api/whatsapp/verify-otp', {
                method: 'POST',
                body: {
                    code: '123456',
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 401);
        });
    });

    describe('Валидация', () => {
        test('должен вернуть 400 при неверном формате кода', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: 'user-id',
                    },
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/whatsapp/verify-otp', {
                method: 'POST',
                body: {
                    code: '12345', // Не 6 цифр
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400, 'invalid_code');
        });

        test('должен вернуть 400 если код не найден', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: 'user-id',
                        user_metadata: {}, // Нет OTP кода
                    },
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/whatsapp/verify-otp', {
                method: 'POST',
                body: {
                    code: '123456',
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400, 'no_code');
        });

        test('должен вернуть 400 если код истек', async () => {
            const expiredDate = new Date(Date.now() - 60000).toISOString(); // Прошедшая дата

            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: 'user-id',
                        user_metadata: {
                            whatsapp_otp_code: '123456',
                            whatsapp_otp_expires: expiredDate,
                        },
                    },
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/whatsapp/verify-otp', {
                method: 'POST',
                body: {
                    code: '123456',
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400, 'expired');
        });

        test('должен вернуть 400 если код неверный', async () => {
            const futureDate = new Date(Date.now() + 600000).toISOString(); // Будущая дата

            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: 'user-id',
                        user_metadata: {
                            whatsapp_otp_code: '123456',
                            whatsapp_otp_expires: futureDate,
                        },
                    },
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/whatsapp/verify-otp', {
                method: 'POST',
                body: {
                    code: '999999', // Неверный код
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400, 'wrong_code');
        });
    });

    describe('Успешная проверка', () => {
        test('должен успешно подтвердить WhatsApp номер', async () => {
            const futureDate = new Date(Date.now() + 600000).toISOString();

            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: 'user-id',
                        user_metadata: {
                            whatsapp_otp_code: '123456',
                            whatsapp_otp_expires: futureDate,
                        },
                    },
                },
                error: null,
            });

            // Мокаем обновление профиля
            mockSupabase.from.mockReturnValueOnce({
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            // Мокаем удаление OTP из user_metadata
            mockSupabase.auth.updateUser.mockResolvedValue({
                data: {
                    user: {
                        id: 'user-id',
                    },
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/whatsapp/verify-otp', {
                method: 'POST',
                body: {
                    code: '123456',
                },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
        });
    });
});


