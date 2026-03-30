import { POST } from '@/app/api/staff/[id]/update/route';
import {
    createMockRequest,
    expectErrorResponse,
    expectSuccessResponse,
    setupApiTestMocks,
} from '../testHelpers';

setupApiTestMocks();

jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/routeParams', () => ({
    getRouteParamUuid: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

jest.mock('@/lib/staffUpdateByIdService', () => ({
    runStaffUpdateById: jest.fn(),
}));

import { getBizContextForManagers } from '@/lib/authBiz';
import { getRouteParamUuid } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';
import { runStaffUpdateById } from '@/lib/staffUpdateByIdService';

describe('/api/staff/[id]/update', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getRouteParamUuid as jest.Mock).mockResolvedValue('staff-1');
        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            bizId: 'biz-1',
            userId: 'manager-1',
        });
        (getServiceClient as jest.Mock).mockReturnValue({ from: jest.fn() });
    });

    test('returns successful update payload', async () => {
        (runStaffUpdateById as jest.Mock).mockResolvedValue({
            ok: true,
            data: { transferred: true },
        });

        const res = await POST(
            createMockRequest('http://localhost/api/staff/staff-1/update', {
                method: 'POST',
                body: {
                    full_name: 'Test',
                    branch_id: 'branch-1',
                    is_active: true,
                },
            }),
            { params: { id: 'staff-1' } },
        );
        const body = await expectSuccessResponse(res, 200);

        expect(body.data).toEqual({ transferred: true });
    });

    test('returns service validation error', async () => {
        (runStaffUpdateById as jest.Mock).mockResolvedValue({
            ok: false,
            status: 400,
            error: 'validation',
            message: 'bad',
        });

        const res = await POST(
            createMockRequest('http://localhost/api/staff/staff-1/update', {
                method: 'POST',
                body: {
                    full_name: '',
                    branch_id: 'branch-1',
                    is_active: true,
                },
            }),
            { params: { id: 'staff-1' } },
        );

        await expectErrorResponse(res, 400, 'validation');
    });
});
