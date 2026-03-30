import { runBranchDeleteRoute } from '@/lib/branchDeleteRouteService';

jest.mock('@/lib/branchDeleteService', () => ({
    runBranchDelete: jest.fn(),
}));

import { runBranchDelete } from '@/lib/branchDeleteService';

describe('branchDeleteRouteService', () => {
    const supabase = {
        rpc: jest.fn(),
    };

    const admin = {};

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns forbidden when user is not super admin', async () => {
        supabase.rpc.mockResolvedValue({
            data: false,
            error: null,
        });

        const result = await runBranchDeleteRoute({
            supabase,
            admin,
            branchId: 'branch-1',
            bizId: 'biz-1',
        });

        expect(result).toEqual({
            ok: false,
            status: 403,
            error: 'forbidden',
            message: 'Только суперадмин может удалять филиалы',
        });
    });

    test('delegates to branch delete service for super admins', async () => {
        supabase.rpc.mockResolvedValue({
            data: true,
            error: null,
        });
        (runBranchDelete as jest.Mock).mockResolvedValue({
            ok: true,
        });

        const result = await runBranchDeleteRoute({
            supabase,
            admin,
            branchId: 'branch-1',
            bizId: 'biz-1',
        });

        expect(runBranchDelete).toHaveBeenCalledWith({
            admin,
            branchId: 'branch-1',
            bizId: 'biz-1',
        });
        expect(result).toEqual({ ok: true });
    });
});
