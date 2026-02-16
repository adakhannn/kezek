/**
 * Тесты для /api/auth/mobile-exchange
 * Обмен токенов для мобильных приложений
 */

import { POST, GET } from '@/app/api/auth/mobile-exchange/route';
import { setupApiTestMocks, createMockRequest, expectSuccessResponse, expectErrorResponse } from '../testHelpers';

setupApiTestMocks();

describe('/api/auth/mobile-exchange', () => {
    describe('POST /api/auth/mobile-exchange', () => {
        test('должен успешно сохранить токены и вернуть код', async () => {
            const req = createMockRequest('http://localhost/api/auth/mobile-exchange', {
                method: 'POST',
                body: {
                    accessToken: 'access-token',
                    refreshToken: 'refresh-token',
                },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('code');
            expect(typeof (data as { code: string }).code).toBe('string');
        });

        test('должен вернуть 400 при отсутствии accessToken', async () => {
            const req = createMockRequest('http://localhost/api/auth/mobile-exchange', {
                method: 'POST',
                body: {
                    refreshToken: 'refresh-token',
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400);
        });

        test('должен вернуть 400 при отсутствии refreshToken', async () => {
            const req = createMockRequest('http://localhost/api/auth/mobile-exchange', {
                method: 'POST',
                body: {
                    accessToken: 'access-token',
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400);
        });
    });

    describe('GET /api/auth/mobile-exchange', () => {
        test('должен успешно обменять код на токены', async () => {
            // Сначала создаем код
            const postReq = createMockRequest('http://localhost/api/auth/mobile-exchange', {
                method: 'POST',
                body: {
                    accessToken: 'access-token',
                    refreshToken: 'refresh-token',
                },
            });

            const postRes = await POST(postReq);
            const postData = await expectSuccessResponse(postRes, 200);
            const code = (postData as { code: string }).code;

            // Теперь обмениваем код на токены
            const getReq = createMockRequest(`http://localhost/api/auth/mobile-exchange?code=${code}`, {
                method: 'GET',
            });

            const getRes = await GET(getReq);
            const getData = await expectSuccessResponse(getRes, 200);

            expect(getData).toHaveProperty('accessToken', 'access-token');
            expect(getData).toHaveProperty('refreshToken', 'refresh-token');
        });

        test('должен вернуть 400 при неверном коде', async () => {
            const req = createMockRequest('http://localhost/api/auth/mobile-exchange?code=INVALID', {
                method: 'GET',
            });

            const res = await GET(req);
            await expectErrorResponse(res, 400);
        });

        test('должен вернуть последний pending код при check=true', async () => {
            // Создаем код
            const postReq = createMockRequest('http://localhost/api/auth/mobile-exchange', {
                method: 'POST',
                body: {
                    accessToken: 'access-token',
                    refreshToken: 'refresh-token',
                },
            });

            await POST(postReq);

            // Проверяем pending код
            const checkReq = createMockRequest('http://localhost/api/auth/mobile-exchange?check=true', {
                method: 'GET',
            });

            const checkRes = await GET(checkReq);
            const checkData = await expectSuccessResponse(checkRes, 200);

            expect(checkData).toHaveProperty('code');
        });
    });
});


