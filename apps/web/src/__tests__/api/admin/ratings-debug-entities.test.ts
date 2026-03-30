import { GET } from '@/app/api/admin/ratings/debug-entities/route';

import { expectErrorResponse, expectSuccessResponse } from '../testHelpers';

jest.mock('@/lib/ratingsDebugEntitiesHttpService', () => ({
    runRatingsDebugEntitiesHttp: jest.fn(),
}));

jest.mock('@/lib/rateLimit', () => ({
    withRateLimit: jest.fn((_req, _config, handler) => handler()),
    RateLimitConfigs: { normal: {} },
}));

const { runRatingsDebugEntitiesHttp } = require('@/lib/ratingsDebugEntitiesHttpService');

describe('/api/admin/ratings/debug-entities', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('delegates GET to http service', async () => {
        runRatingsDebugEntitiesHttp.mockResolvedValue(
            Response.json({
                ok: true,
                data: {
                    days: 7,
                    window_since: '2026-03-20',
                    with_null_rating: { staff: [], branches: [], businesses: [] },
                    without_metrics_since: {
                        staff: [],
                        branches: [],
                        businesses: [],
                        total_count: { staff: 0, branches: 0, businesses: 0 },
                    },
                    recent_errors: [],
                },
            }),
        );

        const res = await GET(
            new Request('http://localhost/api/admin/ratings/debug-entities'),
        );
        const data = await expectSuccessResponse(res);

        expect(data.data.days).toBe(7);
    });

    test('surfaces http service errors', async () => {
        runRatingsDebugEntitiesHttp.mockResolvedValue(
            Response.json(
                { ok: false, error: 'forbidden', message: 'Доступ запрещен' },
                { status: 403 },
            ),
        );

        const res = await GET(
            new Request('http://localhost/api/admin/ratings/debug-entities'),
        );
        const data = await expectErrorResponse(res, 403, 'forbidden');

        expect(data.message).toBe('Доступ запрещен');
    });
});
