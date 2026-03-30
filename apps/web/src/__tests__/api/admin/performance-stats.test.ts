/**
 * Тесты для /api/admin/performance/stats
 */

import { GET } from '@/app/api/admin/performance/stats/route';
import { expectErrorResponse, expectSuccessResponse, setupApiTestMocks, createMockRequest } from '../testHelpers';

setupApiTestMocks();

jest.mock('@/lib/performanceStatsHttpService', () => ({
    runPerformanceStatsHttp: jest.fn(),
}));

import { runPerformanceStatsHttp } from '@/lib/performanceStatsHttpService';

describe('/api/admin/performance/stats', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('delegates GET to performance http service', async () => {
        (runPerformanceStatsHttp as jest.Mock).mockResolvedValue(
            Response.json({
                ok: true,
                data: {
                    stats: [{ operation: 'operation1', count: 10 }],
                    timestamp: 123,
                },
            }),
        );

        const req = createMockRequest('http://localhost/api/admin/performance/stats', {
            method: 'GET',
        });

        const res = await GET(req);
        const data = await expectSuccessResponse(res, 200);

        expect(data.data.stats).toHaveLength(1);
        expect(data.data.timestamp).toBe(123);
    });

    test('surfaces auth error from performance http service', async () => {
        (runPerformanceStatsHttp as jest.Mock).mockResolvedValue(
            Response.json({
                ok: false,
                error: 'auth',
                message: 'not authorized',
            }, { status: 401 }),
        );

        const req = createMockRequest('http://localhost/api/admin/performance/stats', {
            method: 'GET',
        });

        const res = await GET(req);
        await expectErrorResponse(res, 401);
    });
});
