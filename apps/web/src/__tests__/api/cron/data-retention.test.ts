import { GET } from '@/app/api/cron/data-retention/route';

import { expectErrorResponse, expectSuccessResponse } from '../testHelpers';

jest.mock('@/lib/dataRetentionCronHttpService', () => ({
    runDataRetentionCronHttp: jest.fn(),
}));

const { runDataRetentionCronHttp } = require('@/lib/dataRetentionCronHttpService');

describe('/api/cron/data-retention', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('delegates GET to cron http service', async () => {
        runDataRetentionCronHttp.mockResolvedValue(
            Response.json({
                ok: true,
                data: { message: 'done', api_metrics_deleted: 1 },
            }),
        );

        const res = await GET(
            new Request('http://localhost/api/cron/data-retention', {
                headers: { authorization: 'Bearer secret' },
            }),
        );
        const data = await expectSuccessResponse(res);

        expect(data.data.api_metrics_deleted).toBe(1);
    });

    test('surfaces auth error from cron http service', async () => {
        runDataRetentionCronHttp.mockResolvedValue(
            Response.json({ ok: false, error: 'auth', message: 'Не авторизован' }, { status: 401 }),
        );

        const res = await GET(
            new Request('http://localhost/api/cron/data-retention', {
                headers: { authorization: 'Bearer wrong' },
            }),
        );
        const data = await expectErrorResponse(res, 401, 'auth');

        expect(data.message).toBe('Не авторизован');
    });
});
