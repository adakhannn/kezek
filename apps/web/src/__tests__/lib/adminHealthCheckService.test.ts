jest.mock('@/lib/cronExecutionHealth', () => ({ readCronExecutionHealth: jest.fn().mockResolvedValue([]) }));
import { runAdminHealthCheck } from '@/lib/adminHealthCheckService';
import { readCronExecutionHealth } from '@/lib/cronExecutionHealth';

describe('adminHealthCheckService', () => {
    const admin = {
        from: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns successful health payload for healthy system', async () => {
        admin.from
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                lt: jest.fn().mockResolvedValue({ data: null, count: 0, error: null }),
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({ data: { metric_date: new Date().toISOString() }, error: null }),
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({ data: { metric_date: new Date().toISOString() }, error: null }),
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({ data: { metric_date: new Date().toISOString() }, error: null }),
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({ data: { created_at: new Date().toISOString() }, error: null }),
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({ data: null, count: 1, error: null }),
            });

        const result = await runAdminHealthCheck({ admin });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.data.ok).toBe(true);
            expect(result.data.checks.shifts.ok).toBe(true);
        }
    });

    test.each(['staff_shifts', 'staff_day_metrics', 'branch_day_metrics', 'biz_day_metrics', 'client_promotion_usage', 'branch_promotions'])('%s dependency failure cannot make the admin dashboard healthy', async failure => {
        admin.from.mockImplementation((table: string) => {
            const result = table === failure ? { data: null, count: null, error: { message: 'unavailable' } }
                : { data: table.endsWith('day_metrics') ? { metric_date: new Date().toISOString() } : null, count: 0, error: null };
            const query = { select: jest.fn(), eq: jest.fn(), lt: jest.fn(), order: jest.fn(), limit: jest.fn(),
                maybeSingle: jest.fn(async () => result), then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve) };
            for (const method of [query.select, query.eq, query.lt, query.order, query.limit]) method.mockReturnValue(query);
            return query;
        });
        expect(await runAdminHealthCheck({ admin })).toMatchObject({ ok: false, statusCode: 500 });
        expect(readCronExecutionHealth).not.toHaveBeenCalled();
    });
});
