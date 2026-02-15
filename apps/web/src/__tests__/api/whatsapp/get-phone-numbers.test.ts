/**
 * Тесты для /api/whatsapp/get-phone-numbers
 * Получение списка номеров телефонов для WhatsApp Business Account
 */

import { GET } from '@/app/api/whatsapp/get-phone-numbers/route';
import { setupApiTestMocks, createMockRequest, expectSuccessResponse, expectErrorResponse } from '../../testHelpers';

setupApiTestMocks();

// Мокаем fetch для внешних запросов
global.fetch = jest.fn();

const originalEnv = process.env;

describe('/api/whatsapp/get-phone-numbers', () => {
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
        test('должен вернуть 400 при отсутствии account_id', async () => {
            const req = createMockRequest('http://localhost/api/whatsapp/get-phone-numbers', {
                method: 'GET',
            });

            const res = await GET(req);
            await expectErrorResponse(res, 400, 'missing_account_id');
        });

        test('должен вернуть 500 при отсутствии WHATSAPP_ACCESS_TOKEN', async () => {
            process.env.WHATSAPP_ACCESS_TOKEN = undefined;

            const req = createMockRequest('http://localhost/api/whatsapp/get-phone-numbers?account_id=123', {
                method: 'GET',
            });

            const res = await GET(req);
            await expectErrorResponse(res, 500, 'no_token');
        });
    });

    describe('Успешное получение номеров', () => {
        test('должен успешно вернуть список номеров телефонов', async () => {
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

            const req = createMockRequest('http://localhost/api/whatsapp/get-phone-numbers?account_id=123456789', {
                method: 'GET',
            });

            const res = await GET(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
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

            const req = createMockRequest('http://localhost/api/whatsapp/get-phone-numbers?account_id=123456789', {
                method: 'GET',
            });

            const res = await GET(req);
            await expectErrorResponse(res, 500);
        });
    });
});

