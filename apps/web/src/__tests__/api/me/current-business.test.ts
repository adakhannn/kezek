import { GET, POST } from '@/app/api/me/current-business/route';

import { createMockRequest, expectErrorResponse, expectSuccessResponse, setupApiTestMocks } from '../testHelpers';

setupApiTestMocks();

jest.mock('@/lib/currentBusinessHttpService', () => ({
    runGetCurrentBusinessHttp: jest.fn(),
    runSetCurrentBusinessHttp: jest.fn(),
}));

jest.mock('@/lib/rateLimit', () => ({
    withRateLimit: jest.fn((_req, _config, handler) => handler()),
    routeRateLimit: jest.fn(() => ({})),
    RateLimitConfigs: { normal: {} },
}));

const { runGetCurrentBusinessHttp, runSetCurrentBusinessHttp } = require('@/lib/currentBusinessHttpService');

describe('/api/me/current-business', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('delegates GET to http service', async () => {
        runGetCurrentBusinessHttp.mockResolvedValue(
            Response.json({ ok: true, data: { currentBizId: 'biz-1', businesses: [] } }),
        );

        const res = await GET();
        const data = await expectSuccessResponse(res);

        expect(data.data.currentBizId).toBe('biz-1');
    });

    test('delegates POST to http service', async () => {
        runSetCurrentBusinessHttp.mockResolvedValue(Response.json({ ok: true }));

        const res = await POST(
            createMockRequest('http://localhost/api/me/current-business', {
                method: 'POST',
                body: { bizId: 'biz-1' },
            }),
        );
        const data = await expectSuccessResponse(res);

        expect(data.ok).toBe(true);
    });

    test('returns validation error when POST service rejects malformed body', async () => {
        runSetCurrentBusinessHttp.mockRejectedValue(new Error('bad json'));

        const res = await POST(
            createMockRequest('http://localhost/api/me/current-business', {
                method: 'POST',
                body: '{',
            }),
        );
        const data = await expectErrorResponse(res, 400, 'validation');

        expect(data.message).toBe('Invalid JSON body');
    });
});
