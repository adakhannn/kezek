/**
 * Тесты для /api/auth/whatsapp/verify-otp
 * Проверка OTP кода и вход/регистрация через WhatsApp
 */

import { POST } from '@/app/api/auth/whatsapp/verify-otp/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../../testHelpers';

setupApiTestMocks();

import { normalizePhoneToE164 } from '@/lib/senders/sms';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';

// Мокаем зависимости
jest.mock('@/lib/senders/sms', () => ({
    normalizePhoneToE164: jest.fn(),
}));

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseAdminClient: jest.fn(),
}));

describe('/api/auth/whatsapp/verify-otp', () => {
    const mockAdmin = createMockSupabase();

    beforeEach(() => {
        jest.clearAllMocks();

        (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockAdmin);
    });

    describe('Валидация', () => {
        test('должен вернуть 400 при отсутствии телефона или кода', async () => {
            const req = createMockRequest('http://localhost/api/auth/whatsapp/verify-otp', {
                method: 'POST',
                body: {},
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400, 'missing_data');
        });

        test('должен вернуть 400 при неверном формате кода', async () => {
            const req = createMockRequest('http://localhost/api/auth/whatsapp/verify-otp', {
                method: 'POST',
                body: {
                    phone: '+996555123456',
                    code: '12345', // Не 6 цифр
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400, 'invalid_code');
        });

        test('должен вернуть 400 при невалидном формате телефона', async () => {
            (normalizePhoneToE164 as jest.Mock).mockReturnValue(null);

            const req = createMockRequest('http://localhost/api/auth/whatsapp/verify-otp', {
                method: 'POST',
                body: {
                    phone: 'invalid-phone',
                    code: '123456',
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400, 'invalid_phone');
        });
    });

    describe('Успешная проверка', () => {
        test('должен успешно проверить OTP и войти существующего пользователя', async () => {
            const phoneE164 = '+996555123456';
            const code = '123456';

            (normalizePhoneToE164 as jest.Mock).mockReturnValue(phoneE164);

            // Мокаем проверку OTP в БД
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                is: jest.fn().mockReturnThis(),
                gt: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: 'otp-id',
                        phone: phoneE164,
                        code,
                        expires_at: new Date(Date.now() + 60000).toISOString(),
                        used_at: null,
                    },
                    error: null,
                }),
            });

            // Мокаем обновление OTP как использованного
            mockAdmin.from.mockReturnValueOnce({
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            // Мокаем список пользователей
            mockAdmin.auth.admin.listUsers.mockResolvedValue({
                data: {
                    users: [
                        {
                            id: 'user-id',
                            phone: phoneE164,
                            user_metadata: {},
                        },
                    ],
                },
                error: null,
            });

            // Мокаем создание сессии
            mockAdmin.auth.admin.generateLink.mockResolvedValue({
                data: {
                    properties: {
                        hashed_token: 'hashed-token',
                    },
                    user: {
                        id: 'user-id',
                    },
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/auth/whatsapp/verify-otp', {
                method: 'POST',
                body: {
                    phone: phoneE164,
                    code,
                },
            });

            const res = await POST(req);
            // Может вернуть редирект или JSON ответ
            expect([200, 302]).toContain(res.status);
        });

        test('должен вернуть 400 при неверном или истекшем OTP', async () => {
            const phoneE164 = '+996555123456';
            const code = '123456';

            (normalizePhoneToE164 as jest.Mock).mockReturnValue(phoneE164);

            // Мокаем проверку OTP в БД (не найден)
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                is: jest.fn().mockReturnThis(),
                gt: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            // Мокаем список пользователей (пользователь не найден)
            mockAdmin.auth.admin.listUsers.mockResolvedValue({
                data: {
                    users: [],
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/auth/whatsapp/verify-otp', {
                method: 'POST',
                body: {
                    phone: phoneE164,
                    code,
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400);
        });
    });
});


