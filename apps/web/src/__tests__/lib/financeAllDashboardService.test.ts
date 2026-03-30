import { runFinanceAllDashboard } from '@/lib/financeAllDashboardService';

describe('financeAllDashboardService', () => {
    const supabase = {
        from: jest.fn(),
    };

    const admin = {
        from: jest.fn(),
        rpc: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns internal error when finance rpc fails', async () => {
        supabase.from
            .mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        order: jest.fn().mockResolvedValue({ data: [], error: null }),
                    }),
                }),
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnThis(),
                    order: jest.fn().mockResolvedValue({ data: [], error: null }),
                }),
            });

        admin.rpc.mockResolvedValue({
            data: null,
            error: { message: 'RPC error', code: '500', details: null, hint: null },
        });

        const result = await runFinanceAllDashboard({
            req: new Request('http://localhost/api/dashboard/finance/all'),
            supabase,
            admin,
            bizId: 'test-biz-id',
        });

        expect(result).toEqual({
            ok: false,
            statusCode: 500,
            errorType: 'internal',
            message: 'RPC error',
            details: { details: null, hint: null, code: '500' },
        });
    });
});
