jest.mock('@/lib/analyticsDailyCronService', () => ({
    runAnalyticsDailyCron: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

jest.mock('@/lib/time', () => ({
    getTimezone: jest.fn(() => 'Asia/Almaty'),
}));

import { runAnalyticsDailyCron } from '@/lib/analyticsDailyCronService';
import { getServiceClient } from '@/lib/supabaseService';

describe('analyticsDailyCronHttpService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getServiceClient as jest.Mock).mockReturnValue({ from: jest.fn() });
    });

    test('returns auth error for invalid secret', async () => {
        const { runAnalyticsDailyCronHttp } = await import('@/lib/analyticsDailyCronHttpService');

        const response = await runAnalyticsDailyCronHttp(
            new Request('http://localhost/api/cron/analytics/daily'),
            'test-secret',
        );
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.error).toBe('auth');
    });

    test('delegates to daily cron service for authorized request', async () => {
        (runAnalyticsDailyCron as jest.Mock).mockResolvedValue({
            ok: true,
            data: {
                message: 'Analytics daily aggregation completed',
                results: [{ date: '2026-03-27', updated: 2 }],
            },
        });
        const { runAnalyticsDailyCronHttp } = await import('@/lib/analyticsDailyCronHttpService');

        const response = await runAnalyticsDailyCronHttp(
            new Request('http://localhost/api/cron/analytics/daily?startDate=2026-03-26&endDate=2026-03-27', {
                headers: { authorization: 'Bearer test-secret' },
            }),
            'test-secret',
        );
        const body = await response.json();

        expect(runAnalyticsDailyCron).toHaveBeenCalledWith(
            expect.objectContaining({
                supabase: expect.any(Object),
                tz: 'Asia/Almaty',
                startDate: '2026-03-26',
                endDate: '2026-03-27',
            }),
        );
        expect(response.status).toBe(200);
        expect(body.data.results).toHaveLength(1);
    });
});
