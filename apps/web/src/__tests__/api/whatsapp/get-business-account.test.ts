/**
 * Тесты для /api/whatsapp/get-business-account
 * Получение WhatsApp Business Account ID и списка номеров
 */

import { GET } from '@/app/api/whatsapp/get-business-account/route';
import { setupApiTestMocks, createMockRequest, expectSuccessResponse, expectErrorResponse } from '../../testHelpers';

setupApiTestMocks();

// Мокаем fetch для внешних запросов
global.fetch = jest.fn();

const originalEnv = process.env;

describe('/api/whatsapp/get-business-account', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env = {
            ...originalEnv,
            WHATSAPP_ACCESS_TOKEN: 'test-token',
        };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('Валидация', () => {
        test('должен вернуть 500 при отсутствии WHATSAPP_ACCESS_TOKEN', async () => {
            process.env.WHATSAPP_ACCESS_TOKEN = undefined;

            const req = createMockRequest('http://localhost/api/whatsapp/get-business-account', {
                method: 'GET',
            });

            const res = await GET(req);
            await expectErrorResponse(res, 500, 'no_token');
        });
    });

    describe('Успешное получение данных', () => {
        test('должен успешно вернуть Business Account и номера', async () => {
            // Мокаем получение Business Accounts
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: [
                        {
                            id: 'business-account-id',
                            name: 'Test Business',
                        },
                    ],
                }),
            });

            // Мокаем получение номеров телефонов
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: [
                        {
                            id: 'phone-id-1',
                            verified_name: 'Test Business',
                            display_phone_number: '+996555123456',
                        },
                    ],
                }),
            });

            const req = createMockRequest('http://localhost/api/whatsapp/get-business-account', {
                method: 'GET',
            });

            const res = await GET(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(data).toHaveProperty('business_accounts');
            expect(data).toHaveProperty('phone_numbers');
        });

        test('должен обработать ошибку от Graph API', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 400,
                text: async () => JSON.stringify({
                    error: {
                        message: 'Invalid access token',
                        code: 190,
                    },
                }),
            });

            const req = createMockRequest('http://localhost/api/whatsapp/get-business-account', {
                method: 'GET',
            });

            const res = await GET(req);
            await expectErrorResponse(res, 500);
        });
    });
});

