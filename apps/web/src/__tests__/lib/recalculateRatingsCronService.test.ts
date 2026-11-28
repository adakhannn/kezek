jest.mock('@/lib/log', () => ({ logError: jest.fn(), logWarn: jest.fn(), logDebug: jest.fn() }));
import { logError } from '@/lib/log';
import { runRecalculateRatingsCron } from '@/lib/recalculateRatingsCronService';

beforeEach(() => jest.clearAllMocks());

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
        expect(rpcMock).toHaveBeenCalledWith('recalculate_ratings_for_date', { p_date: '2026-03-26' });
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

    function failingRun(sendAlertEmail: jest.Mock) {
        return runRecalculateRatingsCron({
            supabase: { from: jest.fn(() => ({ select: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: null }) })), rpc: jest.fn() } as never,
            measurePerformance: async () => ({ data: null, error: { message: 'rpc failed', code: '500' } }),
            sendAlertEmail, tz: 'Asia/Almaty', todayStr: '2026-03-27', nowMs: () => 1000,
        });
    }

    test('an unconfigured alert inbox is not logged again as an error (KEZEK-WEB-2/3/6)', async () => {
        const sendAlertEmail = jest.fn().mockResolvedValue({ success: false, error: 'ALERT_EMAIL_TO or EMAIL_FROM not configured', notConfigured: true });
        await failingRun(sendAlertEmail);
        // Only the real failure is an error; sendAlertEmail already warned about the configuration.
        expect(logError).toHaveBeenCalledTimes(1);
        expect(logError).toHaveBeenCalledWith('RecalculateRatingsCron', 'RPC recalculate_ratings_for_date failed', expect.anything());
    });

    test('a real alert delivery failure is still an error', async () => {
        const sendAlertEmail = jest.fn().mockResolvedValue({ success: false, error: 'domain not verified' });
        await failingRun(sendAlertEmail);
        expect(logError).toHaveBeenCalledWith('RecalculateRatingsCron', 'Failed to send alert email', 'domain not verified');
    });

    test('critical rating alert: an unconfigured inbox does not add an error', async () => {
        const fromMock = jest.fn((table: string) => {
            if (table === 'biz_day_metrics') {
                return { select: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({ data: { metric_date: '2026-03-25' } }), eq: jest.fn().mockReturnThis() };
            }
            if (table === 'rating_recalc_errors') {
                return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: [{ id: '1', entity_type: 'staff' }], error: null }) };
            }
            return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue(createCountResult(1)), is: jest.fn().mockResolvedValue(createCountResult(0)) };
        });
        const sendAlertEmail = jest.fn().mockResolvedValue({ success: false, error: 'ALERT_EMAIL_TO or EMAIL_FROM not configured', notConfigured: true });
        const result = await runRecalculateRatingsCron({
            supabase: { from: fromMock, rpc: jest.fn().mockResolvedValue({ data: { ok: true }, error: null }) } as never,
            measurePerformance: async (_operation, fn) => fn(),
            sendAlertEmail, tz: 'Asia/Almaty', todayStr: '2026-03-27', nowMs: () => 1000,
        });
        expect(result.ok).toBe(true);
        expect(sendAlertEmail).toHaveBeenCalledWith([expect.objectContaining({ type: 'error', details: expect.objectContaining({ errorsSummary: { total: 1, byType: { staff: 1 } } }) })]);
        expect(logError).not.toHaveBeenCalled();
    });
});
