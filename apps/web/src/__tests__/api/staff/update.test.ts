import { POST } from '@/app/api/staff/update/route';
import {
    createMockRequest,
    createMockSupabase,
    expectErrorResponse,
    expectSuccessResponse,
    setupApiTestMocks,
} from '../testHelpers';

setupApiTestMocks();

import { getBizContextForManagers } from '@/lib/authBiz';
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

describe('/api/staff/update', () => {
    const mockSupabase = createMockSupabase();
    const mockServiceClient = createMockSupabase();

    beforeEach(() => {
        jest.clearAllMocks();
        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            supabase: mockSupabase,
            userId: '11111111-1111-4111-8111-111111111111',
            bizId: '22222222-2222-4222-8222-222222222222',
        });
        (getRouteParamUuid as jest.Mock).mockResolvedValue('33333333-3333-4333-8333-333333333333');
        (getServiceClient as jest.Mock).mockReturnValue(mockServiceClient);
    });

    test('returns 403 when manager has no allowed role', async () => {
        mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'user_roles') {
                const query = {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn(),
                };
                query.eq
                    .mockImplementationOnce(() => query)
                    .mockResolvedValueOnce({
                        data: [],
                        error: null,
                    });
                return query;
            }
            return mockSupabase;
        });

        const req = createMockRequest('http://localhost/api/staff/update', {
            method: 'POST',
            body: {
                full_name: 'Updated Staff',
                branch_id: 'branch-id',
                is_active: true,
            },
        });

        const res = await POST(req, { params: { id: '33333333-3333-4333-8333-333333333333' } });
        await expectErrorResponse(res, 403, 'forbidden');
    });

    test('returns 400 when required fields are missing', async () => {
        mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'user_roles') {
                const query = {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn(),
                };
                query.eq
                    .mockImplementationOnce(() => query)
                    .mockResolvedValueOnce({
                        data: [{ roles: { key: 'owner' } }],
                        error: null,
                    });
                return query;
            }
            return mockSupabase;
        });

        const req = createMockRequest('http://localhost/api/staff/update', {
            method: 'POST',
            body: {},
        });

        const res = await POST(req, { params: { id: '33333333-3333-4333-8333-333333333333' } });
        await expectErrorResponse(res, 400, 'validation');
    });

    test('updates a staff member', async () => {
        mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'user_roles') {
                const query = {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn(),
                };
                query.eq
                    .mockImplementationOnce(() => query)
                    .mockResolvedValueOnce({
                        data: [{ roles: { key: 'owner' } }],
                        error: null,
                    });
                return query;
            }

            if (table === 'staff') {
                const updateQuery = {
                    update: jest.fn(),
                    eq: jest.fn(),
                };
                updateQuery.update.mockReturnValue(updateQuery);
                updateQuery.eq
                    .mockImplementationOnce(() => updateQuery)
                    .mockResolvedValueOnce({
                        data: null,
                        error: null,
                    });
                return updateQuery;
            }

            return mockSupabase;
        });

        mockServiceClient.auth.admin.listUsers.mockResolvedValue({
            data: { users: [] },
            error: null,
        });

        const req = createMockRequest('http://localhost/api/staff/update', {
            method: 'POST',
            body: {
                full_name: 'Updated Staff',
                branch_id: 'branch-id',
                is_active: true,
            },
        });

        const res = await POST(req, { params: { id: '33333333-3333-4333-8333-333333333333' } });
        const data = await expectSuccessResponse(res, 200);

        expect(data.user_linked).toBe(false);
    });
});
