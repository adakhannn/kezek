/**
 * Тесты для /api/whatsapp/diagnose
 * Полная диагностика WhatsApp API
 */

import { GET } from '@/app/api/whatsapp/diagnose/route';
import { setupApiTestMocks, createMockRequest, expectSuccessResponse, expectErrorResponse } from '../../testHelpers';

setupApiTestMocks();

// Мокаем fetch для внешних запросов
global.fetch = jest.fn();

const originalEnv = process.env;

describe('/api/whatsapp/diagnose', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env = {
            ...originalEnv,
            WHATSAPP_ACCESS_TOKEN: 'test-token',
            WHATSAPP_PHONE_NUMBER_ID: '123456789',
        };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('Валидация', () => {
        test('должен вернуть 500 при отсутствии WHATSAPP_ACCESS_TOKEN', async () => {
            process.env.WHATSAPP_ACCESS_TOKEN = undefined;

            const req = createMockRequest('http://localhost/api/whatsapp/diagnose', {
                method: 'GET',
            });

            const res = await GET(req);
            await expectErrorResponse(res, 500, 'no_token');
        });
    });

    describe('Успешная диагностика', () => {
        test('должен успешно выполнить полную диагностику', async () => {
            // Мокаем проверку токена
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    id: 'user-id',
                    name: 'Test User',
                }),
            });

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
                        },
                    ],
                }),
            });

            const req = createMockRequest('http://localhost/api/whatsapp/diagnose', {
                method: 'GET',
            });

            const res = await GET(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(data).toHaveProperty('tokenCheck');
            expect(data).toHaveProperty('businessAccounts');
            expect(data).toHaveProperty('phoneNumbers');
            expect(data).toHaveProperty('recommendations');
        });
    });
});

