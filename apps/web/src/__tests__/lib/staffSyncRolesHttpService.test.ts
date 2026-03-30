jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

jest.mock('@/lib/staffSyncRolesService', () => ({
    runStaffSyncRoles: jest.fn(),
}));

import { getBizContextForManagers } from '@/lib/authBiz';
import { runStaffSyncRolesHttp } from '@/lib/staffSyncRolesHttpService';
import { runStaffSyncRoles } from '@/lib/staffSyncRolesService';
import { getServiceClient } from '@/lib/supabaseService';

describe('staffSyncRolesHttpService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            supabase: { auth: { getUser: jest.fn() }, from: jest.fn(), rpc: jest.fn() },
            bizId: 'biz-id',
        });
        (getServiceClient as jest.Mock).mockReturnValue({ from: jest.fn() });
    });

    test('delegates sync request to service', async () => {
        (runStaffSyncRoles as jest.Mock).mockResolvedValue({
            ok: true,
            data: { synced: 3, total: 4 },
        });

        const response = await runStaffSyncRolesHttp();
        const body = await response.json();

        expect(runStaffSyncRoles).toHaveBeenCalledWith({
            supabase: expect.any(Object),
            admin: expect.any(Object),
            bizId: 'biz-id',
        });
        expect(response.status).toBe(200);
        expect(body.data.synced).toBe(3);
    });
});
