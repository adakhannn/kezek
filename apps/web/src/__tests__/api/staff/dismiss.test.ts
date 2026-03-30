import { POST } from '@/app/api/staff/[id]/dismiss/route';
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

describe('/api/staff/[id]/dismiss', () => {
    const mockAdmin = createMockSupabase();
    const mockAdminClient = createMockSupabase();
    const staffId = '11111111-1111-4111-8111-111111111111';
    const bizId = '22222222-2222-4222-8222-222222222222';
    const userId = '33333333-3333-4333-8333-333333333333';

    beforeEach(() => {
        jest.clearAllMocks();
        (getBizContextForManagers as jest.Mock).mockResolvedValue({ bizId });
        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);
        (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockAdminClient);
        (getRouteParamRequired as jest.Mock).mockResolvedValue(staffId);
    });

    test('returns 404 when staff member is not found', async () => {
        (checkResourceBelongsToBiz as jest.Mock).mockResolvedValue({
            data: null,
            error: 'Resource not found',
        });

        const req = createMockRequest(`http://localhost/api/staff/${staffId}/dismiss`, { method: 'POST' });
        const res = await POST(req, { params: { id: staffId } });

        await expectErrorResponse(res, 404, 'STAFF_NOT_FOUND');
    });

    test('returns 409 when staff member has future bookings', async () => {
        (checkResourceBelongsToBiz as jest.Mock).mockResolvedValue({
            data: { id: staffId, biz_id: bizId, user_id: userId, is_active: true, full_name: 'Test Staff' },
            error: null,
        });

        mockAdmin.from.mockReturnValueOnce({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            neq: jest.fn().mockReturnThis(),
            gt: jest.fn().mockResolvedValue({
                count: 3,
                error: null,
            }),
        });

        const req = createMockRequest(`http://localhost/api/staff/${staffId}/dismiss`, { method: 'POST' });
        const res = await POST(req, { params: { id: staffId } });

        await expectErrorResponse(res, 409, 'HAS_FUTURE_BOOKINGS');
    });

    test('dismisses staff member and demotes linked user to client', async () => {
        (checkResourceBelongsToBiz as jest.Mock).mockResolvedValue({
            data: { id: staffId, biz_id: bizId, user_id: userId, is_active: true, full_name: 'Test Staff' },
            error: null,
        });

        mockAdmin.from
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                neq: jest.fn().mockReturnThis(),
                gt: jest.fn().mockResolvedValue({
                    count: 0,
                    error: null,
                }),
            })
            .mockReturnValueOnce({
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
            });

        let rolesCall = 0;
        mockAdminClient.from.mockImplementation((table: string) => {
            if (table === 'roles') {
                rolesCall += 1;
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: { id: 'client-role-id' },
                        error: null,
                    }),
                };
            }

            if (table === 'user_roles') {
                return {
                    delete: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    neq: jest.fn().mockResolvedValue({
                        data: null,
                        error: null,
                    }),
                    upsert: jest.fn().mockResolvedValue({
                        data: null,
                        error: null,
                    }),
                };
            }

            return mockAdminClient;
        });

        const req = createMockRequest(`http://localhost/api/staff/${staffId}/dismiss`, { method: 'POST' });
        const res = await POST(req, { params: { id: staffId } });
        const data = await expectSuccessResponse(res, 200);

        expect(data.ok).toBe(true);
    });

    test('dismisses staff member without linked user role updates', async () => {
        (checkResourceBelongsToBiz as jest.Mock).mockResolvedValue({
            data: { id: staffId, biz_id: bizId, user_id: null, is_active: true, full_name: 'Test Staff' },
            error: null,
        });

        mockAdmin.from
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                neq: jest.fn().mockReturnThis(),
                gt: jest.fn().mockResolvedValue({
                    count: 0,
                    error: null,
                }),
            })
            .mockReturnValueOnce({
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
            });

        const req = createMockRequest(`http://localhost/api/staff/${staffId}/dismiss`, { method: 'POST' });
        const res = await POST(req, { params: { id: staffId } });
        const data = await expectSuccessResponse(res, 200);

        expect(data.ok).toBe(true);
    });
});
