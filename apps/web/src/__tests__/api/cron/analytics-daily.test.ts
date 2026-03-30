import { GET, POST } from '@/app/api/cron/analytics/daily/route';

import { expectErrorResponse, expectSuccessResponse } from '../testHelpers';

jest.mock('@/lib/analyticsDailyCronHttpService', () => ({
    runAnalyticsDailyCronHttp: jest.fn(),
}));

const { runAnalyticsDailyCronHttp } = require('@/lib/analyticsDailyCronHttpService');

describe('/api/cron/analytics/daily', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('delegates GET to cron http service', async () => {
        runAnalyticsDailyCronHttp.mockResolvedValue(
            Response.json({
                ok: true,
                data: { message: 'done', results: [{ date: '2026-03-27', updated: 1 }] },
            }),
        );

        const res = await GET(
            new Request('http://localhost/api/cron/analytics/daily', {
                headers: { authorization: 'Bearer secret' },
            }),
        );
        const data = await expectSuccessResponse(res);

        expect(data.data.results).toHaveLength(1);
    });

    test('delegates POST to cron http service', async () => {
        runAnalyticsDailyCronHttp.mockResolvedValue(
            Response.json({
                ok: true,
                data: { message: 'done', results: [] },
            }),
        );

        const res = await POST(
            new Request('http://localhost/api/cron/analytics/daily', {
                method: 'POST',
                headers: { authorization: 'Bearer secret' },
            }),
        );
        const data = await expectSuccessResponse(res);

        expect(data.ok).toBe(true);
    });

    test('surfaces auth error from cron http service', async () => {
        runAnalyticsDailyCronHttp.mockResolvedValue(
            Response.json({ ok: false, error: 'auth', message: 'РќРµ Р°РІС‚РѕСЂРёР·РѕРІР°РЅ' }, { status: 401 }),
        );

        const res = await GET(
            new Request('http://localhost/api/cron/analytics/daily', {
                headers: { authorization: 'Bearer wrong' },
            }),
        );
        const data = await expectErrorResponse(res, 401, 'auth');

        expect(data.message).toBe('РќРµ Р°РІС‚РѕСЂРёР·РѕРІР°РЅ');
    });
});
