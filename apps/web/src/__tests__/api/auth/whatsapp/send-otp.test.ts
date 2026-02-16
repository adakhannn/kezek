/**
 * Тесты для /api/auth/whatsapp/send-otp
 * Отправка OTP кода на WhatsApp
 */

import { POST } from '@/app/api/auth/whatsapp/send-otp/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../../testHelpers';

setupApiTestMocks();

import { normalizePhoneToE164 } from '@/lib/senders/sms';
import { sendWhatsApp } from '@/lib/senders/whatsapp';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';

// Мокаем зависимости
jest.mock('@/lib/senders/sms', () => ({
    normalizePhoneToE164: jest.fn(),
}));

jest.mock('@/lib/senders/whatsapp', () => ({
    sendWhatsApp: jest.fn(),
}));

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseAdminClient: jest.fn(),
}));

describe('/api/auth/whatsapp/send-otp', () => {
    const mockAdmin = createMockSupabase();

    beforeEach(() => {
        jest.clearAllMocks();

        (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockAdmin);
    });

    describe('Валидация', () => {
        test('должен вернуть 400 при отсутствии телефона', async () => {
            const req = createMockRequest('http://localhost/api/auth/whatsapp/send-otp', {
                method: 'POST',
                body: {},
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400, 'no_phone');
        });

        test('должен вернуть 400 при невалидном формате телефона', async () => {
            (normalizePhoneToE164 as jest.Mock).mockReturnValue(null);

            const req = createMockRequest('http://localhost/api/auth/whatsapp/send-otp', {
                method: 'POST',
                body: {
                    phone: 'invalid-phone',
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400, 'invalid_phone');
        });
    });

    describe('Успешная отправка', () => {
        test('должен успешно отправить OTP для существующего пользователя', async () => {
            const phoneE164 = '+996555123456';

            (normalizePhoneToE164 as jest.Mock).mockReturnValue(phoneE164);
            (sendWhatsApp as jest.Mock).mockResolvedValue(undefined);

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

            // Мокаем обновление user_metadata
            mockAdmin.auth.admin.updateUserById.mockResolvedValue({
                data: {
                    user: {
                        id: 'user-id',
                    },
                },
                error: null,
            });

            // Мокаем сохранение OTP в БД
            mockAdmin.from.mockReturnValueOnce({
                insert: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: {
                        id: 'otp-id',
                        phone: phoneE164,
                        code: '123456',
                    },
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/auth/whatsapp/send-otp', {
                method: 'POST',
                body: {
                    phone: phoneE164,
                },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(sendWhatsApp).toHaveBeenCalled();
        });

        test('должен успешно отправить OTP для нового пользователя', async () => {
            const phoneE164 = '+996555123456';

            (normalizePhoneToE164 as jest.Mock).mockReturnValue(phoneE164);
            (sendWhatsApp as jest.Mock).mockResolvedValue(undefined);

            // Мокаем список пользователей (пользователь не найден)
            mockAdmin.auth.admin.listUsers.mockResolvedValue({
                data: {
                    users: [],
                },
                error: null,
            });

            // Мокаем сохранение OTP в БД
            mockAdmin.from.mockReturnValueOnce({
                insert: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: {
                        id: 'otp-id',
                        phone: phoneE164,
                        code: '123456',
                    },
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/auth/whatsapp/send-otp', {
                method: 'POST',
                body: {
                    phone: phoneE164,
                },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(sendWhatsApp).toHaveBeenCalled();
        });

        test('должен вернуть 500 при ошибке отправки WhatsApp', async () => {
            const phoneE164 = '+996555123456';

            (normalizePhoneToE164 as jest.Mock).mockReturnValue(phoneE164);
            (sendWhatsApp as jest.Mock).mockRejectedValue(new Error('WhatsApp service unavailable'));

            // Мокаем список пользователей
            mockAdmin.auth.admin.listUsers.mockResolvedValue({
                data: {
                    users: [],
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/auth/whatsapp/send-otp', {
                method: 'POST',
                body: {
                    phone: phoneE164,
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 500, 'send_failed');
        });
    });
});


