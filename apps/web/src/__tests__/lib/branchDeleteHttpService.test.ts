jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/routeParams', () => ({
    getRouteParamUuid: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

jest.mock('@/lib/branchDeleteRouteService', () => ({
    runBranchDeleteRoute: jest.fn(),
}));

import { getBizContextForManagers } from '@/lib/authBiz';
import { runBranchDeleteHttp } from '@/lib/branchDeleteHttpService';
import { runBranchDeleteRoute } from '@/lib/branchDeleteRouteService';
import { getRouteParamUuid } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

describe('branchDeleteHttpService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getRouteParamUuid as jest.Mock).mockResolvedValue('branch-id');
        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            supabase: { rpc: jest.fn() },
            bizId: 'biz-id',
        });
        (getServiceClient as jest.Mock).mockReturnValue({ from: jest.fn() });
    });

    test('delegates delete request to branch delete route service', async () => {
        (runBranchDeleteRoute as jest.Mock).mockResolvedValue({ ok: true });

        const response = await runBranchDeleteHttp({ params: { id: 'branch-id' } });
        const body = await response.json();

        expect(runBranchDeleteRoute).toHaveBeenCalledWith({
            supabase: expect.any(Object),
            admin: expect.any(Object),
            branchId: 'branch-id',
            bizId: 'biz-id',
        });
        expect(response.status).toBe(200);
        expect(body.ok).toBe(true);
    });
});
