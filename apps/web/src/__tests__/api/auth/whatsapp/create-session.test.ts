/**
 * Тесты для /api/auth/whatsapp/create-session
 * Создание сессии для пользователя после проверки OTP через WhatsApp
 */

import { POST } from '@/app/api/auth/whatsapp/create-session/route';
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

describe('/api/auth/whatsapp/create-session', () => {
    const mockAdmin = createMockSupabase();

    beforeEach(() => {
        jest.clearAllMocks();

        (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockAdmin);
    });

    describe('Валидация', () => {
        test('должен вернуть 400 при отсутствии phone и userId', async () => {
            const req = createMockRequest('http://localhost/api/auth/whatsapp/create-session', {
                method: 'POST',
                body: {},
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400, 'missing_data');
        });

        test('должен вернуть 400 при невалидном формате телефона', async () => {
            (normalizePhoneToE164 as jest.Mock).mockReturnValue(null);

            const req = createMockRequest('http://localhost/api/auth/whatsapp/create-session', {
                method: 'POST',
                body: {
                    phone: 'invalid-phone',
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400, 'invalid_phone');
        });
    });

    describe('Успешное создание сессии', () => {
        test('должен успешно создать сессию по userId', async () => {
            const userId = 'user-id';

            mockAdmin.auth.admin.getUserById.mockResolvedValue({
                data: {
                    user: {
                        id: userId,
                        email: 'test@example.com',
                    },
                },
                error: null,
            });

            // Мокаем создание access token
            mockAdmin.auth.admin.generateLink.mockResolvedValue({
                data: {
                    properties: {
                        hashed_token: 'hashed-token',
                    },
                    user: {
                        id: userId,
                    },
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/auth/whatsapp/create-session', {
                method: 'POST',
                body: {
                    userId,
                },
            });

            const res = await POST(req);
            // Может вернуть редирект или JSON ответ
            expect([200, 302]).toContain(res.status);
        });

        test('должен успешно создать сессию по phone', async () => {
            const phoneE164 = '+996555123456';
            const userId = 'user-id';

            (normalizePhoneToE164 as jest.Mock).mockReturnValue(phoneE164);

            mockAdmin.auth.admin.listUsers.mockResolvedValue({
                data: {
                    users: [
                        {
                            id: userId,
                            phone: phoneE164,
                            user_metadata: {},
                        },
                    ],
                },
                error: null,
            });

            // Мокаем создание access token
            mockAdmin.auth.admin.generateLink.mockResolvedValue({
                data: {
                    properties: {
                        hashed_token: 'hashed-token',
                    },
                    user: {
                        id: userId,
                    },
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/auth/whatsapp/create-session', {
                method: 'POST',
                body: {
                    phone: phoneE164,
                },
            });

            const res = await POST(req);
            expect([200, 302]).toContain(res.status);
        });

        test('должен вернуть 404 если пользователь не найден', async () => {
            (normalizePhoneToE164 as jest.Mock).mockReturnValue('+996555123456');

            mockAdmin.auth.admin.listUsers.mockResolvedValue({
                data: {
                    users: [],
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/auth/whatsapp/create-session', {
                method: 'POST',
                body: {
                    phone: '+996555123456',
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 404, 'user_not_found');
        });
    });
});

