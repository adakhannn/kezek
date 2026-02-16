/**
 * Тесты для /api/whatsapp/test
 * Тестовый endpoint для проверки конфигурации WhatsApp
 */

import { GET } from '@/app/api/whatsapp/test/route';
import { setupApiTestMocks, createMockRequest, expectSuccessResponse } from '../../testHelpers';

setupApiTestMocks();

const originalEnv = process.env;

describe('/api/whatsapp/test', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    test('должен вернуть информацию о конфигурации при правильной настройке', async () => {
        process.env = {
            ...originalEnv,
            WHATSAPP_ACCESS_TOKEN: 'test-token-1234567890',
            WHATSAPP_PHONE_NUMBER_ID: '123456789',
            WHATSAPP_VERIFY_TOKEN: 'verify-token',
        };

        const req = createMockRequest('http://localhost/api/whatsapp/test', {
            method: 'GET',
        });

        const res = await GET(req);
        const data = await expectSuccessResponse(res, 200);

        expect(data).toHaveProperty('configured', true);
        expect(data).toHaveProperty('details');
        expect(data).toHaveProperty('message');
    });

    test('должен вернуть информацию о неполной конфигурации', async () => {
        process.env = {
            ...originalEnv,
            WHATSAPP_ACCESS_TOKEN: undefined,
            WHATSAPP_PHONE_NUMBER_ID: undefined,
            WHATSAPP_VERIFY_TOKEN: undefined,
        };

        const req = createMockRequest('http://localhost/api/whatsapp/test', {
            method: 'GET',
        });

        const res = await GET(req);
        const data = await expectSuccessResponse(res, 200);

        expect(data).toHaveProperty('configured', false);
        expect(data).toHaveProperty('details');
        expect(data).toHaveProperty('message');
    });

    test('должен вернуть информацию о невалидном Phone Number ID', async () => {
        process.env = {
            ...originalEnv,
            WHATSAPP_ACCESS_TOKEN: 'test-token',
            WHATSAPP_PHONE_NUMBER_ID: 'invalid-id', // Не число
            WHATSAPP_VERIFY_TOKEN: 'verify-token',
        };

        const req = createMockRequest('http://localhost/api/whatsapp/test', {
            method: 'GET',
        });

        const res = await GET(req);
        const data = await expectSuccessResponse(res, 200);

        expect(data).toHaveProperty('configured', false);
        expect((data as { details: { WHATSAPP_PHONE_NUMBER_ID_VALID: boolean } }).details.WHATSAPP_PHONE_NUMBER_ID_VALID).toBe(false);
    });
});


