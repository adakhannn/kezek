import { POST } from '@/app/api/staff/[id]/transfer/route';
import {
    createMockRequest,
    createMockSupabase,
    expectErrorResponse,
    expectSuccessResponse,
    setupApiTestMocks,
} from '../testHelpers';

setupApiTestMocks();

import { getBizContextForManagers } from '@/lib/authBiz';
import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
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

jest.mock('@/lib/dbHelpers', () => ({
    checkResourceBelongsToBiz: jest.fn(),
}));

describe('/api/staff/[id]/transfer', () => {
    const mockAdmin = createMockSupabase();
    const staffId = 'staff-uuid';
    const bizId = 'biz-uuid';
    const currentBranchId = 'current-branch-uuid';
    const targetBranchId = 'target-branch-uuid';

    beforeEach(() => {
        jest.clearAllMocks();

        (getBizContextForManagers as jest.Mock).mockResolvedValue({ bizId });
        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);
        (getRouteParamRequired as jest.Mock).mockResolvedValue(staffId);
    });

    test('returns 400 when target_branch_id is missing', async () => {
        (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
            data: {
                id: staffId,
                biz_id: bizId,
                branch_id: currentBranchId,
            },
            error: null,
        });

        const req = createMockRequest(`http://localhost/api/staff/${staffId}/transfer`, {
            method: 'POST',
            body: {},
        });

        const res = await POST(req, { params: { id: staffId } });
        await expectErrorResponse(res, 400, 'TARGET_BRANCH_REQUIRED');
    });

    test('returns 403 when staff does not belong to the business', async () => {
        (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
            data: null,
            error: 'Resource not found',
        });

        const req = createMockRequest(`http://localhost/api/staff/${staffId}/transfer`, {
            method: 'POST',
            body: { target_branch_id: targetBranchId },
        });

        const res = await POST(req, { params: { id: staffId } });
        await expectErrorResponse(res, 403, 'STAFF_NOT_IN_THIS_BUSINESS');
    });

    test('returns 400 when staff is already in the target branch', async () => {
        (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
            data: {
                id: staffId,
                biz_id: bizId,
                branch_id: targetBranchId,
            },
            error: null,
        });

        const req = createMockRequest(`http://localhost/api/staff/${staffId}/transfer`, {
            method: 'POST',
            body: { target_branch_id: targetBranchId },
        });

        const res = await POST(req, { params: { id: staffId } });
        await expectErrorResponse(res, 400, 'ALREADY_IN_TARGET_BRANCH');
    });

    test('returns 403 when target branch does not belong to the business', async () => {
        (checkResourceBelongsToBiz as jest.Mock)
            .mockResolvedValueOnce({
                data: {
                    id: staffId,
                    biz_id: bizId,
                    branch_id: currentBranchId,
                },
                error: null,
            })
            .mockResolvedValueOnce({
                data: null,
                error: 'Resource not found',
            });

        const req = createMockRequest(`http://localhost/api/staff/${staffId}/transfer`, {
            method: 'POST',
            body: { target_branch_id: targetBranchId },
        });

        const res = await POST(req, { params: { id: staffId } });
        await expectErrorResponse(res, 403, 'BRANCH_NOT_IN_THIS_BUSINESS');
    });

    test('returns 400 when target branch is inactive', async () => {
        (checkResourceBelongsToBiz as jest.Mock)
            .mockResolvedValueOnce({
                data: {
                    id: staffId,
                    biz_id: bizId,
                    branch_id: currentBranchId,
                },
                error: null,
            })
            .mockResolvedValueOnce({
                data: {
                    id: targetBranchId,
                    biz_id: bizId,
                    is_active: false,
                },
                error: null,
            });

        const req = createMockRequest(`http://localhost/api/staff/${staffId}/transfer`, {
            method: 'POST',
            body: { target_branch_id: targetBranchId },
        });

        const res = await POST(req, { params: { id: staffId } });
        await expectErrorResponse(res, 400, 'TARGET_BRANCH_INACTIVE');
    });

    test('transfers staff to another branch successfully', async () => {
        (checkResourceBelongsToBiz as jest.Mock)
            .mockResolvedValueOnce({
                data: {
                    id: staffId,
                    biz_id: bizId,
                    branch_id: currentBranchId,
                },
                error: null,
            })
            .mockResolvedValueOnce({
                data: {
                    id: targetBranchId,
                    biz_id: bizId,
                    is_active: true,
                },
                error: null,
            });

        mockAdmin.from
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                is: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            })
            .mockReturnValueOnce({
                insert: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

        const staffUpdateQuery: { update: jest.Mock; eq: jest.Mock } = {
            update: jest.fn(),
            eq: jest.fn(),
        };
        staffUpdateQuery.update.mockReturnValue(staffUpdateQuery);
        staffUpdateQuery.eq
            .mockImplementationOnce(() => staffUpdateQuery)
            .mockResolvedValueOnce({
                data: null,
                error: null,
            });
        mockAdmin.from.mockReturnValueOnce(staffUpdateQuery);

        const req = createMockRequest(`http://localhost/api/staff/${staffId}/transfer`, {
            method: 'POST',
            body: {
                target_branch_id: targetBranchId,
                copy_schedule: false,
            },
        });

        const res = await POST(req, { params: { id: staffId } });
        const data = await expectSuccessResponse(res, 200);

        expect(data).toHaveProperty('ok', true);
    });
});
