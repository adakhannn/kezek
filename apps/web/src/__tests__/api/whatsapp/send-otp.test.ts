/**
 * Тесты для /api/whatsapp/send-otp
 * Отправка OTP кода на WhatsApp для подтверждения номера
 */

import { POST } from '@/app/api/whatsapp/send-otp/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../../testHelpers';

setupApiTestMocks();

import { normalizePhoneToE164 } from '@/lib/senders/sms';
import { sendWhatsApp } from '@/lib/senders/whatsapp';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

// Мокаем зависимости
jest.mock('@/lib/senders/sms', () => ({
    normalizePhoneToE164: jest.fn(),
}));

jest.mock('@/lib/senders/whatsapp', () => ({
    sendWhatsApp: jest.fn(),
}));

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseServerClient: jest.fn(),
}));

jest.mock('@/lib/rateLimit', () => ({
    withRateLimit: jest.fn((req, config, handler) => handler()),
    RateLimitConfigs: {
        auth: {},
    },
}));

describe('/api/whatsapp/send-otp', () => {
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

            const req = createMockRequest('http://localhost/api/whatsapp/send-otp', {
                method: 'POST',
            });

            const res = await POST(req);
            await expectErrorResponse(res, 401);
        });
    });

    describe('Валидация', () => {
        test('должен вернуть 400 если номер телефона не указан в профиле', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: 'user-id',
                    },
                },
                error: null,
            });

            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        phone: null,
                        whatsapp_verified: false,
                    },
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/whatsapp/send-otp', {
                method: 'POST',
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400, 'no_phone');
        });

        test('должен вернуть 400 если WhatsApp уже подтвержден', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: 'user-id',
                    },
                },
                error: null,
            });

            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        phone: '+996555123456',
                        whatsapp_verified: true, // Уже подтвержден
                    },
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/whatsapp/send-otp', {
                method: 'POST',
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400, 'already_verified');
        });
    });

    describe('Успешная отправка', () => {
        test('должен успешно отправить OTP код', async () => {
            const phoneE164 = '+996555123456';

            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: 'user-id',
                    },
                },
                error: null,
            });

            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        phone: phoneE164,
                        whatsapp_verified: false,
                    },
                    error: null,
                }),
            });

            (normalizePhoneToE164 as jest.Mock).mockReturnValue(phoneE164);
            (sendWhatsApp as jest.Mock).mockResolvedValue(undefined);

            // Мокаем сохранение OTP в user_metadata
            mockSupabase.auth.updateUser.mockResolvedValue({
                data: {
                    user: {
                        id: 'user-id',
                    },
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/whatsapp/send-otp', {
                method: 'POST',
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(sendWhatsApp).toHaveBeenCalled();
        });
    });
});


