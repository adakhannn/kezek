import { runRecalculateRatingsCron } from '@/lib/recalculateRatingsCronService';

function createCountResult(count: number) {
    return { count };
}

describe('recalculateRatingsCronService', () => {
    test('recalculates a single-day interval and returns summaries', async () => {
        const fromMock = jest.fn();
        const rpcMock = jest.fn().mockResolvedValue({
            data: { ok: true },
            error: null,
        });

        fromMock.mockImplementation((table: string) => {
            if (table === 'biz_day_metrics') {
                return {
                    select: jest.fn().mockReturnThis(),
                    order: jest.fn().mockReturnThis(),
                    limit: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: { metric_date: '2026-03-25' },
                    }),
                    eq: jest.fn().mockReturnThis(),
                };
            }

            if (table === 'rating_recalc_errors') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockResolvedValue({
                        data: [],
                        error: null,
                    }),
                };
            }

            return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue(createCountResult(1)),
                is: jest.fn().mockResolvedValue(createCountResult(0)),
            };
        });

        const result = await runRecalculateRatingsCron({
            supabase: {
                from: fromMock,
                rpc: rpcMock,
            } as never,
            measurePerformance: async (_operation, fn) => fn(),
            sendAlertEmail: jest.fn().mockResolvedValue({ success: true }),
            tz: 'Asia/Almaty',
            todayStr: '2026-03-27',
            nowMs: () => 1000,
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.data.rangeStart).toBe('2026-03-26');
            expect(result.data.rangeEnd).toBe('2026-03-26');
            expect(result.data.processedDays).toBe(1);
        }
        expect(rpcMock).toHaveBeenCalledWith('recalculate_ratings_for_date', { p_date: null });
    });

    test('sends alert and returns failure when rpc result has error', async () => {
        const fromMock = jest.fn().mockImplementation(() => ({
            select: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: null,
            }),
        }));
        const sendAlertEmail = jest.fn().mockResolvedValue({ success: true });

        const result = await runRecalculateRatingsCron({
            supabase: {
                from: fromMock,
                rpc: jest.fn(),
            } as never,
            measurePerformance: async () => ({
                data: null,
                error: { message: 'rpc failed', code: '500' },
            }),
            sendAlertEmail,
            tz: 'Asia/Almaty',
            todayStr: '2026-03-27',
            nowMs: () => 1000,
        });

        expect(result).toEqual({
            ok: false,
            error: 'rpc failed',
            status: 500,
        });
        expect(sendAlertEmail).toHaveBeenCalled();
    });
});
