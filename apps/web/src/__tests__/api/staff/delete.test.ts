import { POST } from '@/app/api/staff/[id]/delete/route';
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
import { getRouteParamUuid } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

jest.mock('@/lib/routeParams', () => ({
    getRouteParamUuid: jest.fn(),
}));

jest.mock('@/lib/dbHelpers', () => ({
    checkResourceBelongsToBiz: jest.fn(),
}));

describe('/api/staff/[id]/delete', () => {
    const mockAdmin = createMockSupabase();
    const staffId = 'staff-uuid';
    const bizId = 'biz-uuid';

    function createFutureBookingsCheck(count: number) {
        return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            neq: jest.fn().mockReturnThis(),
            gt: jest.fn().mockResolvedValue({
                count,
                error: null,
            }),
        };
    }

    function createBizAndStaffDeleteWithLt() {
        const query = {
            delete: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            lt: jest.fn().mockResolvedValue({
                data: null,
                error: null,
            }),
        };

        return query;
    }

    function createDoubleEqDelete() {
        const query = {
            delete: jest.fn().mockReturnThis(),
            eq: jest.fn(),
        };

        let eqCalls = 0;
        query.eq.mockImplementation(() => {
            eqCalls += 1;
            return eqCalls >= 2
                ? Promise.resolve({ data: null, error: null })
                : query;
        });

        return query;
    }

    function createSingleEqDelete() {
        return {
            delete: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({
                data: null,
                error: null,
            }),
        };
    }

    beforeEach(() => {
        jest.clearAllMocks();

        (getBizContextForManagers as jest.Mock).mockResolvedValue({ bizId });
        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);
        (getRouteParamUuid as jest.Mock).mockResolvedValue(staffId);
    });

    test('returns 404 when staff is missing', async () => {
        (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
            data: null,
            error: 'Resource not found',
        });

        const req = createMockRequest(`http://localhost/api/staff/${staffId}/delete`, {
            method: 'POST',
        });

        const res = await POST(req, { params: { id: staffId } });
        await expectErrorResponse(res, 404);
    });

    test('returns 409 when future active bookings exist', async () => {
        (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
            data: {
                id: staffId,
                biz_id: bizId,
                user_id: null,
                is_active: true,
                full_name: 'Test Staff',
            },
            error: null,
        });

        mockAdmin.from.mockReturnValueOnce(createFutureBookingsCheck(5));

        const req = createMockRequest(`http://localhost/api/staff/${staffId}/delete`, {
            method: 'POST',
        });

        const res = await POST(req, { params: { id: staffId } });
        await expectErrorResponse(res, 409);
    });

    test('deletes staff without future bookings', async () => {
        (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
            data: {
                id: staffId,
                biz_id: bizId,
                user_id: null,
                is_active: true,
                full_name: 'Test Staff',
            },
            error: null,
        });

        mockAdmin.from
            .mockReturnValueOnce(createFutureBookingsCheck(0))
            .mockReturnValueOnce(createBizAndStaffDeleteWithLt())
            .mockReturnValueOnce(createDoubleEqDelete())
            .mockReturnValueOnce(createSingleEqDelete())
            .mockReturnValueOnce(createDoubleEqDelete())
            .mockReturnValueOnce(createDoubleEqDelete())
            .mockReturnValueOnce(createDoubleEqDelete())
            .mockReturnValueOnce(createDoubleEqDelete());

        const req = createMockRequest(`http://localhost/api/staff/${staffId}/delete`, {
            method: 'POST',
        });

        const res = await POST(req, { params: { id: staffId } });
        const data = await expectSuccessResponse(res, 200);

        expect(data).toHaveProperty('ok', true);
    });
});
