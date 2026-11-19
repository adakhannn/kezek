import { POST } from '@/app/api/staff/[id]/transfer/route';
import {
    createMockRequest,
    createMockSupabase,
    expectErrorResponse,
    expectSuccessResponse,
} from '../testHelpers';

import { getBizContextForManagers } from '@/lib/authBiz';
import { getRouteParamRequired } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

jest.mock('@/lib/routeParams', () => ({
    getRouteParamRequired: jest.fn(),
}));

// ARCH-07: the route always runs the atomic transfer_staff_home command, whatever SCHEDULE_V2_ENABLED says.
describe('/api/staff/[id]/transfer', () => {
    const mockAdmin = createMockSupabase();
    const staffId = '00000000-0000-0000-0000-000000000001';
    const currentBranchId = '00000000-0000-0000-0000-000000000002';
    const targetBranchId = '00000000-0000-0000-0000-000000000003';
    const bizId = 'biz-uuid';

    const transfer = (body: Record<string, unknown>) => POST(
        createMockRequest(`http://localhost/api/staff/${staffId}/transfer`, { method: 'POST', body }),
        { params: { id: staffId } },
    );

    beforeEach(() => {
        jest.clearAllMocks();
        delete process.env.SCHEDULE_V2_ENABLED;
        (getBizContextForManagers as jest.Mock).mockResolvedValue({ bizId, userId: 'manager-id' });
        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);
        (getRouteParamRequired as jest.Mock).mockResolvedValue(staffId);
        mockAdmin.rpc.mockResolvedValue({ data: { note: 'HOME_BRANCH_CHANGED_SCHEDULE_PRESERVED' }, error: null });
    });

    test('returns 400 when target_branch_id is missing, without calling the command', async () => {
        const res = await transfer({ expected_branch_id: currentBranchId });
        await expectErrorResponse(res, 400, 'validation');
        expect(mockAdmin.rpc).not.toHaveBeenCalled();
    });

    test('returns 403 when the command refuses the manager', async () => {
        mockAdmin.rpc.mockResolvedValueOnce({ data: null, error: { message: 'SCHEDULE_FORBIDDEN' } });
        const res = await transfer({ target_branch_id: targetBranchId, expected_branch_id: currentBranchId });
        await expectErrorResponse(res, 403, 'SCHEDULE_FORBIDDEN');
    });

    test('returns 409 when the staff member already moved', async () => {
        mockAdmin.rpc.mockResolvedValueOnce({ data: null, error: { message: 'SCHEDULE_STALE' } });
        const res = await transfer({ target_branch_id: targetBranchId, expected_branch_id: currentBranchId });
        await expectErrorResponse(res, 409, 'SCHEDULE_STALE');
    });

    test('transfers staff to another branch with one command and no table writes', async () => {
        const res = await transfer({ target_branch_id: targetBranchId, expected_branch_id: currentBranchId, copy_schedule: true });
        const data = await expectSuccessResponse(res, 200);

        expect(data).toMatchObject({ ok: true, data: { note: 'HOME_BRANCH_CHANGED_SCHEDULE_PRESERVED' } });
        expect(mockAdmin.rpc).toHaveBeenCalledWith('transfer_staff_home', {
            p_staff: staffId,
            p_biz: bizId,
            p_actor: 'manager-id',
            p_expected_branch: currentBranchId,
            p_target: targetBranchId,
        });
        expect(mockAdmin.from).not.toHaveBeenCalled();
    });
});
