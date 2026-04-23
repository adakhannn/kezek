import { POST, GET } from '@/app/api/auth/mobile-exchange/route';
import {
    setupApiTestMocks,
    createMockNextRequest,
    createMockRequest,
    expectSuccessResponse,
    expectErrorResponse,
} from '../testHelpers';

setupApiTestMocks();

describe('/api/auth/mobile-exchange', () => {
    describe('POST /api/auth/mobile-exchange', () => {
        test('stores tokens and returns exchange code', async () => {
            const req = createMockRequest('http://localhost/api/auth/mobile-exchange', {
                method: 'POST',
                body: {
                    accessToken: 'access-token',
                    refreshToken: 'refresh-token',
                },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('data.code');
            expect(typeof (data as { data: { code: string } }).data.code).toBe('string');
        });

        test('returns 400 when accessToken missing', async () => {
            const req = createMockRequest('http://localhost/api/auth/mobile-exchange', {
                method: 'POST',
                body: {
                    refreshToken: 'refresh-token',
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400);
        });

        test('returns 400 when refreshToken missing', async () => {
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
        test('exchanges code to tokens', async () => {
            const postReq = createMockRequest('http://localhost/api/auth/mobile-exchange', {
                method: 'POST',
                body: {
                    accessToken: 'access-token',
                    refreshToken: 'refresh-token',
                },
            });

            const postRes = await POST(postReq);
            const postData = await expectSuccessResponse(postRes, 200);
            const code = (postData as { data: { code: string } }).data.code;

            const getReq = createMockNextRequest(`http://localhost/api/auth/mobile-exchange?code=${code}`, {
                method: 'GET',
            });

            const getRes = await GET(getReq);
            const getData = await expectSuccessResponse(getRes, 200);

            expect(getData).toHaveProperty('data.accessToken', 'access-token');
            expect(getData).toHaveProperty('data.refreshToken', 'refresh-token');
        });

        test('returns 404 for unknown code', async () => {
            const req = createMockNextRequest('http://localhost/api/auth/mobile-exchange?code=INVALID', {
                method: 'GET',
            });

            const res = await GET(req);
            await expectErrorResponse(res, 404);
        });

        test('returns 409 when same exchange code is retried', async () => {
            const postReq = createMockRequest('http://localhost/api/auth/mobile-exchange', {
                method: 'POST',
                body: {
                    accessToken: 'access-token',
                    refreshToken: 'refresh-token',
                },
            });

            const postRes = await POST(postReq);
            const postData = await expectSuccessResponse(postRes, 200);
            const code = (postData as { data: { code: string } }).data.code;

            const firstGetReq = createMockNextRequest(
                `http://localhost/api/auth/mobile-exchange?code=${code}`,
                { method: 'GET' },
            );
            const firstGetRes = await GET(firstGetReq);
            await expectSuccessResponse(firstGetRes, 200);

            const secondGetReq = createMockNextRequest(
                `http://localhost/api/auth/mobile-exchange?code=${code}`,
                { method: 'GET' },
            );
            const secondGetRes = await GET(secondGetReq);
            await expectErrorResponse(secondGetRes, 409, 'conflict');
        });

        test('returns latest pending code with check=true', async () => {
            const postReq = createMockRequest('http://localhost/api/auth/mobile-exchange', {
                method: 'POST',
                body: {
                    accessToken: 'access-token',
                    refreshToken: 'refresh-token',
                },
            });

            await POST(postReq);

            const checkReq = createMockNextRequest('http://localhost/api/auth/mobile-exchange?check=true', {
                method: 'GET',
            });

            const checkRes = await GET(checkReq);
            const checkData = await expectSuccessResponse(checkRes, 200);

            expect(checkData).toHaveProperty('data.code');
        });
    });
});
