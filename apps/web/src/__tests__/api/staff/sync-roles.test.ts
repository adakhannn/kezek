import { POST } from '@/app/api/staff/sync-roles/route';
import {
    createMockRequest,
    createMockSupabase,
    expectErrorResponse,
    expectSuccessResponse,
    setupApiTestMocks,
} from '../testHelpers';

setupApiTestMocks();

import { getBizContextForManagers } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';

jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

describe('/api/staff/sync-roles', () => {
    const mockSupabase = createMockSupabase();
    const mockAdmin = createMockSupabase();
    const bizId = 'biz-uuid';
    const userId = 'user-id';

    function createRolesAccessQuery(roles: Array<{ roles: { key: string } }>) {
        const query = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn(),
        };

        let eqCalls = 0;
        query.eq.mockImplementation(() => {
            eqCalls += 1;
            return eqCalls >= 2
                ? Promise.resolve({
                      data: roles,
                      error: null,
                  })
                : query;
        });

        return query;
    }

    function createStaffRoleQuery() {
        return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: { id: 'staff-role-id' },
                error: null,
            }),
        };
    }

    function createStaffListQuery(staffList: Array<{ id: string; user_id: string; full_name: string }>) {
        return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            not: jest.fn().mockResolvedValue({
                data: staffList,
                error: null,
            }),
        };
    }

    function createUserRoleExistsQuery(exists: boolean) {
        return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: exists ? { id: 'existing-role-id' } : null,
                error: null,
            }),
        };
    }

    beforeEach(() => {
        jest.clearAllMocks();

        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            supabase: mockSupabase,
            bizId,
        });

        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);
    });

    test('returns 401 when user is not authenticated', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: null },
            error: null,
        });

        const req = createMockRequest('http://localhost/api/staff/sync-roles', {
            method: 'POST',
        });

        const res = await POST(req);
        await expectErrorResponse(res, 401, 'UNAUTHORIZED');
    });

    test('returns 403 when user lacks required business role', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: userId } },
            error: null,
        });

        mockSupabase.from.mockReturnValueOnce(createRolesAccessQuery([]));

        const req = createMockRequest('http://localhost/api/staff/sync-roles', {
            method: 'POST',
        });

        const res = await POST(req);
        await expectErrorResponse(res, 403, 'FORBIDDEN');
    });

    test('syncs missing staff roles successfully', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: userId } },
            error: null,
        });

        mockSupabase.from.mockReturnValueOnce(
            createRolesAccessQuery([{ roles: { key: 'owner' } }])
        );

        mockAdmin.from
            .mockReturnValueOnce(createStaffRoleQuery())
            .mockReturnValueOnce(
                createStaffListQuery([
                    { id: 'staff-1', user_id: 'user-1', full_name: 'Staff 1' },
                    { id: 'staff-2', user_id: 'user-2', full_name: 'Staff 2' },
                ])
            )
            .mockReturnValueOnce(createUserRoleExistsQuery(false))
            .mockReturnValueOnce({
                insert: jest.fn().mockResolvedValue({ data: null, error: null }),
            })
            .mockReturnValueOnce(createUserRoleExistsQuery(true));

        const req = createMockRequest('http://localhost/api/staff/sync-roles', {
            method: 'POST',
        });

        const res = await POST(req);
        const data = await expectSuccessResponse(res, 200);

        expect(data).toHaveProperty('ok', true);
        expect(data).toHaveProperty('synced', 1);
        expect(data).toHaveProperty('total', 2);
    });

    test('returns success when there are no active staff with user_id', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: userId } },
            error: null,
        });

        mockSupabase.from.mockReturnValueOnce(
            createRolesAccessQuery([{ roles: { key: 'admin' } }])
        );

        mockAdmin.from
            .mockReturnValueOnce(createStaffRoleQuery())
            .mockReturnValueOnce(createStaffListQuery([]));

        const req = createMockRequest('http://localhost/api/staff/sync-roles', {
            method: 'POST',
        });

        const res = await POST(req);
        const data = await expectSuccessResponse(res, 200);

        expect(data).toHaveProperty('ok', true);
        expect(data).toHaveProperty('synced', 0);
    });
});
