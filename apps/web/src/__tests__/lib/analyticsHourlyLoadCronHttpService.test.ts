import { runAnalyticsHourlyLoadCronHttp } from '@/lib/analyticsHourlyLoadCronHttpService';

jest.mock('@/lib/analyticsHourlyLoadCronService', () => ({
    recalcHourlyForDate: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

jest.mock('@/lib/time', () => ({
    addDaysToDateString: jest.fn(() => '2026-03-26'),
    dateRangeInclusive: jest.fn(() => ['2026-03-20', '2026-03-21']),
    getTimezone: jest.fn(() => 'Asia/Almaty'),
    todayDateString: jest.fn(() => '2026-03-27'),
}));

const { recalcHourlyForDate } = require('@/lib/analyticsHourlyLoadCronService');
const { getServiceClient } = require('@/lib/supabaseService');

describe('analyticsHourlyLoadCronHttpService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        getServiceClient.mockReturnValue({ mocked: true });
    });

    test('returns auth error for invalid cron secret', async () => {
        const res = await runAnalyticsHourlyLoadCronHttp(
            new Request('http://localhost/api/cron/analytics/hourly-load', {
                headers: { authorization: 'Bearer wrong' },
            }),
            'secret',
        );
        const data = await res.json();

        expect(res.status).toBe(401);
        expect(data.error).toBe('auth');
    });

    test('uses explicit range when start and end dates are valid', async () => {
        recalcHourlyForDate
            .mockResolvedValueOnce({ date: '2026-03-20', updated: 2 })
            .mockResolvedValueOnce({ date: '2026-03-21', updated: 3 });

        const res = await runAnalyticsHourlyLoadCronHttp(
            new Request(
                'http://localhost/api/cron/analytics/hourly-load?startDate=2026-03-20&endDate=2026-03-21',
                {
                    headers: { authorization: 'Bearer secret' },
                },
            ),
            'secret',
        );
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.data.results).toEqual([
            { date: '2026-03-20', updated: 2 },
            { date: '2026-03-21', updated: 3 },
        ]);
    });

    test('falls back to previous day when params are missing', async () => {
        recalcHourlyForDate.mockResolvedValue({ date: '2026-03-26', updated: 1 });

        const res = await runAnalyticsHourlyLoadCronHttp(
            new Request('http://localhost/api/cron/analytics/hourly-load', {
                headers: { authorization: 'Bearer secret' },
            }),
            'secret',
        );
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.data.results).toEqual([{ date: '2026-03-26', updated: 1 }]);
    });
});
