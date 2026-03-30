import { POST } from '@/app/api/staff/create/route';
import {
    createMockRequest,
    createMockSupabase,
    expectErrorResponse,
    expectSuccessResponse,
    setupApiTestMocks,
} from '../testHelpers';

setupApiTestMocks();

import { getBizContextForManagers } from '@/lib/authBiz';
import { initializeStaffSchedule } from '@/lib/staffSchedule';
import { getServiceClient } from '@/lib/supabaseService';

jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

jest.mock('@/lib/staffSchedule', () => ({
    initializeStaffSchedule: jest.fn(),
}));

describe('/api/staff/create', () => {
    const mockSupabase = createMockSupabase();
    const mockServiceClient = createMockSupabase();

    beforeEach(() => {
        jest.clearAllMocks();
        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            supabase: mockSupabase,
            userId: '11111111-1111-4111-8111-111111111111',
            bizId: '22222222-2222-4222-8222-222222222222',
        });
        (getServiceClient as jest.Mock).mockReturnValue(mockServiceClient);
        (initializeStaffSchedule as jest.Mock).mockResolvedValue({
            success: true,
            daysCreated: 14,
        });
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

        const req = createMockRequest('http://localhost/api/staff/create', {
            method: 'POST',
            body: { full_name: 'Test Staff', branch_id: 'branch-id' },
        });

        const res = await POST(req);
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

        const req = createMockRequest('http://localhost/api/staff/create', {
            method: 'POST',
            body: {},
        });

        const res = await POST(req);
        await expectErrorResponse(res, 400, 'validation');
    });

    test('creates a new staff member', async () => {
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
                return {
                    insert: jest.fn().mockReturnThis(),
                    select: jest.fn().mockReturnThis(),
                    single: jest.fn().mockResolvedValue({
                        data: { id: 'staff-id' },
                        error: null,
                    }),
                };
            }

            return mockSupabase;
        });
        mockServiceClient.auth.admin.listUsers.mockResolvedValue({
            data: { users: [] },
            error: null,
        });
        mockServiceClient.from.mockImplementation((table: string) => {
            if (table === 'staff_branch_assignments') {
                return {
                    insert: jest.fn().mockResolvedValue({
                        data: null,
                        error: null,
                    }),
                };
            }
            return mockServiceClient;
        });

        const req = createMockRequest('http://localhost/api/staff/create', {
            method: 'POST',
            body: {
                full_name: 'Test Staff',
                branch_id: 'branch-id',
                is_active: true,
            },
        });

        const res = await POST(req);
        const data = await expectSuccessResponse(res, 200);

        expect(data.id).toBe('staff-id');
        expect(data.user_linked).toBe(false);
        expect(data.schedule_initialized).toBe(true);
    });

    test('returns 400 when staff insert fails', async () => {
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
                return {
                    insert: jest.fn().mockReturnThis(),
                    select: jest.fn().mockReturnThis(),
                    single: jest.fn().mockResolvedValue({
                        data: null,
                        error: { message: 'Duplicate entry', code: '23505' },
                    }),
                };
            }

            return mockSupabase;
        });
        mockServiceClient.auth.admin.listUsers.mockResolvedValue({
            data: { users: [] },
            error: null,
        });

        const req = createMockRequest('http://localhost/api/staff/create', {
            method: 'POST',
            body: {
                full_name: 'Test Staff',
                branch_id: 'branch-id',
                is_active: true,
            },
        });

        const res = await POST(req);
        await expectErrorResponse(res, 400, 'validation');
    });
});
