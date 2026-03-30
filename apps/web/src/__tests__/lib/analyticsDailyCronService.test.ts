import { runAnalyticsDailyCron } from '@/lib/analyticsDailyCronService';

describe('analyticsDailyCronService', () => {
    test('aggregates a single day and upserts stats', async () => {
        const upsert = jest.fn().mockResolvedValue({ error: null });
        const fromMock = jest.fn().mockImplementation((table: string) => {
            if (table === 'analytics_events') {
                return {
                    select: jest.fn().mockReturnThis(),
                    gte: jest.fn().mockReturnThis(),
                    lte: jest.fn().mockResolvedValue({
                        data: [
                            { biz_id: 'biz-1', event_type: 'home_view' },
                            { biz_id: 'biz-1', event_type: 'booking_created' },
                        ],
                        error: null,
                    }),
                };
            }

            if (table === 'bookings') {
                return {
                    select: jest.fn().mockReturnThis(),
                    gte: jest.fn().mockReturnThis(),
                    lte: jest.fn().mockResolvedValue({
                        data: [
                            {
                                biz_id: 'biz-1',
                                status: 'confirmed',
                                promotion_applied: null,
                                service_id: 'service-1',
                            },
                        ],
                        error: null,
                    }),
                };
            }

            if (table === 'services') {
                return {
                    select: jest.fn().mockReturnThis(),
                    in: jest.fn().mockResolvedValue({
                        data: [{ id: 'service-1', price_from: 1000, price_to: 2000 }],
                        error: null,
                    }),
                };
            }

            if (table === 'business_daily_stats') {
                return {
                    upsert,
                };
            }

            throw new Error(`Unexpected table ${table}`);
        });

        const result = await runAnalyticsDailyCron({
            supabase: { from: fromMock } as never,
            tz: 'Asia/Almaty',
            today: '2026-03-27',
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.data.results).toEqual([{ date: '2026-03-26', updated: 1 }]);
        }
        expect(upsert).toHaveBeenCalled();
    });

    test('uses explicit date range when provided', async () => {
        const upsert = jest.fn().mockResolvedValue({ error: null });
        const fromMock = jest.fn().mockImplementation((table: string) => {
            if (table === 'analytics_events' || table === 'bookings') {
                return {
                    select: jest.fn().mockReturnThis(),
                    gte: jest.fn().mockReturnThis(),
                    lte: jest.fn().mockResolvedValue({
                        data: [],
                        error: null,
                    }),
                };
            }

            if (table === 'business_daily_stats') {
                return { upsert };
            }

            if (table === 'services') {
                return {
                    select: jest.fn().mockReturnThis(),
                    in: jest.fn().mockResolvedValue({
                        data: [],
                        error: null,
                    }),
                };
            }

            throw new Error(`Unexpected table ${table}`);
        });

        const result = await runAnalyticsDailyCron({
            supabase: { from: fromMock } as never,
            tz: 'Asia/Almaty',
            startDate: '2026-03-24',
            endDate: '2026-03-25',
            today: '2026-03-27',
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.data.results).toEqual([
                { date: '2026-03-24', updated: 0 },
                { date: '2026-03-25', updated: 0 },
            ]);
        }
    });
});
