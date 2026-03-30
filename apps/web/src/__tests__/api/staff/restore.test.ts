import { POST } from '@/app/api/staff/[id]/restore/route';
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
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';
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

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseAdminClient: jest.fn(),
}));

describe('/api/staff/[id]/restore', () => {
    const mockAdmin = createMockSupabase();
    const mockAdminClient = createMockSupabase();
    const staffId = 'staff-uuid';
    const bizId = 'biz-uuid';
    const userId = 'user-id';

    function createDoubleEqUpdateQuery(result: { data: unknown; error: unknown }) {
        const query = {
            update: jest.fn().mockReturnThis(),
            eq: jest.fn(),
        };

        let eqCalls = 0;
        query.eq.mockImplementation(() => {
            eqCalls += 1;
            return eqCalls >= 2 ? Promise.resolve(result) : query;
        });

        return query;
    }

    beforeEach(() => {
        jest.clearAllMocks();

        (getBizContextForManagers as jest.Mock).mockResolvedValue({ bizId });
        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);
        (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockAdminClient);
        (getRouteParamRequired as jest.Mock).mockResolvedValue(staffId);
    });

    test('returns 404 when staff is missing', async () => {
        (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
            data: null,
            error: 'Resource not found',
        });

        const req = createMockRequest(`http://localhost/api/staff/${staffId}/restore`, {
            method: 'POST',
        });

        const res = await POST(req, { params: { id: staffId } });
        await expectErrorResponse(res, 404, 'STAFF_NOT_FOUND');
    });

    test('restores staff with linked user role', async () => {
        (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
            data: {
                id: staffId,
                biz_id: bizId,
                user_id: userId,
                is_active: false,
            },
            error: null,
        });

        mockAdmin.from.mockReturnValueOnce(
            createDoubleEqUpdateQuery({
                data: null,
                error: null,
            })
        );

        mockAdminClient.from
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: { id: 'staff-role-id' },
                    error: null,
                }),
            })
            .mockReturnValueOnce({
                upsert: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

        const req = createMockRequest(`http://localhost/api/staff/${staffId}/restore`, {
            method: 'POST',
        });

        const res = await POST(req, { params: { id: staffId } });
        const data = await expectSuccessResponse(res, 200);

        expect(data).toHaveProperty('ok', true);
    });

    test('restores staff without linked user', async () => {
        (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
            data: {
                id: staffId,
                biz_id: bizId,
                user_id: null,
                is_active: false,
            },
            error: null,
        });

        mockAdmin.from.mockReturnValueOnce(
            createDoubleEqUpdateQuery({
                data: null,
                error: null,
            })
        );

        const req = createMockRequest(`http://localhost/api/staff/${staffId}/restore`, {
            method: 'POST',
        });

        const res = await POST(req, { params: { id: staffId } });
        const data = await expectSuccessResponse(res, 200);

        expect(data).toHaveProperty('ok', true);
    });
});
