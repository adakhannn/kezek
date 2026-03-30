import { GET, POST } from '@/app/api/cron/analytics/hourly-load/route';

import { expectErrorResponse, expectSuccessResponse } from '../testHelpers';

jest.mock('@/lib/analyticsHourlyLoadCronHttpService', () => ({
    runAnalyticsHourlyLoadCronHttp: jest.fn(),
}));

const { runAnalyticsHourlyLoadCronHttp } = require('@/lib/analyticsHourlyLoadCronHttpService');

describe('/api/cron/analytics/hourly-load', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('delegates GET to cron http service', async () => {
        runAnalyticsHourlyLoadCronHttp.mockResolvedValue(
            Response.json({
                ok: true,
                data: { message: 'done', results: [{ date: '2026-03-26', updated: 1 }] },
            }),
        );

        const res = await GET(
            new Request('http://localhost/api/cron/analytics/hourly-load', {
                headers: { authorization: 'Bearer secret' },
            }),
        );
        const data = await expectSuccessResponse(res);

        expect(data.data.results).toHaveLength(1);
    });

    test('delegates POST to cron http service', async () => {
        runAnalyticsHourlyLoadCronHttp.mockResolvedValue(
            Response.json({
                ok: true,
                data: { message: 'done', results: [] },
            }),
        );

        const res = await POST(
            new Request('http://localhost/api/cron/analytics/hourly-load', {
                method: 'POST',
                headers: { authorization: 'Bearer secret' },
            }),
        );
        const data = await expectSuccessResponse(res);

        expect(data.ok).toBe(true);
    });

    test('surfaces auth error from cron http service', async () => {
        runAnalyticsHourlyLoadCronHttp.mockResolvedValue(
            Response.json({ ok: false, error: 'auth', message: 'Не авторизован' }, { status: 401 }),
        );

        const res = await GET(
            new Request('http://localhost/api/cron/analytics/hourly-load', {
                headers: { authorization: 'Bearer wrong' },
            }),
        );
        const data = await expectErrorResponse(res, 401, 'auth');

        expect(data.message).toBe('Не авторизован');
    });
});
