import { runAdminHealthCheck } from '@/lib/adminHealthCheckService';

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
                lt: jest.fn().mockResolvedValue({ data: [], error: null }),
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
                eq: jest.fn().mockResolvedValue({ data: [{ id: 'promo-1' }], error: null }),
            });

        const result = await runAdminHealthCheck({ admin });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.data.ok).toBe(true);
            expect(result.data.checks.shifts.ok).toBe(true);
        }
    });
});
