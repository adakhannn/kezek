import { POST } from '@/app/api/dashboard/staff/[id]/shift/open/route';
import {
    createMockRequest,
    createMockSupabase,
    expectErrorResponse,
    expectSuccessResponse,
    setupApiTestMocks,
} from '../../testHelpers';

setupApiTestMocks();

import { withManagerAndStaffContext } from '@/lib/withManagerAndStaffContext';

jest.mock('@/lib/withManagerAndStaffContext', () => ({
    withManagerAndStaffContext: jest.fn(),
}));

jest.mock('@/lib/rateLimit', () => ({
    withRateLimit: jest.fn((req, _config, handler) => handler()),
    RateLimitConfigs: {
        critical: {},
    },
}));

describe('/api/dashboard/staff/[id]/shift/open', () => {
    const mockSupabase = createMockSupabase();
    const mockAdmin = createMockSupabase();
    const staffId = 'staff-uuid';
    const bizId = 'biz-uuid';

    beforeEach(() => {
        jest.clearAllMocks();

        (withManagerAndStaffContext as jest.Mock).mockImplementation(
            async (_req, _context, _config, handler) =>
                handler({
                    supabase: mockSupabase,
                    admin: mockAdmin,
                    bizId,
                    staffId,
                    staff: {
                        id: staffId,
                        biz_id: bizId,
                        branch_id: 'branch-id',
                    },
                })
        );
    });

    test('returns 404 when helper cannot find staff', async () => {
        (withManagerAndStaffContext as jest.Mock).mockResolvedValueOnce(
            new Response(JSON.stringify({ ok: false, error: 'not_found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        const req = createMockRequest(`http://localhost/api/dashboard/staff/${staffId}/shift/open`, {
            method: 'POST',
        });

        const res = await POST(req, { params: { id: staffId } });
        await expectErrorResponse(res, 404);
    });

    test('returns 403 when helper denies access', async () => {
        (withManagerAndStaffContext as jest.Mock).mockResolvedValueOnce(
            new Response(JSON.stringify({ ok: false, error: 'forbidden' }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        const req = createMockRequest(`http://localhost/api/dashboard/staff/${staffId}/shift/open`, {
            method: 'POST',
        });

        const res = await POST(req, { params: { id: staffId } });
        await expectErrorResponse(res, 403);
    });

    test('opens a new shift successfully', async () => {
        mockSupabase.from
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            });

        mockAdmin.from
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            })
            .mockReturnValueOnce({
                insert: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: {
                        id: 'shift-id',
                        staff_id: staffId,
                        shift_date: '2024-01-15',
                        status: 'open',
                    },
                    error: null,
                }),
            });

        const req = createMockRequest(`http://localhost/api/dashboard/staff/${staffId}/shift/open?date=2024-01-15`, {
            method: 'POST',
        });

        const res = await POST(req, { params: { id: staffId } });
        const data = await expectSuccessResponse(res, 200);

        expect(data).toHaveProperty('ok', true);
        expect(data.data).toHaveProperty('shift');
    });

    test('returns an existing open shift idempotently', async () => {
        mockSupabase.from
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            });

        mockAdmin.from.mockReturnValueOnce({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: {
                    id: 'existing-shift-id',
                    staff_id: staffId,
                    shift_date: '2024-01-15',
                    status: 'open',
                },
                error: null,
            }),
        });

        const req = createMockRequest(`http://localhost/api/dashboard/staff/${staffId}/shift/open?date=2024-01-15`, {
            method: 'POST',
        });

        const res = await POST(req, { params: { id: staffId } });
        const data = await expectSuccessResponse(res, 200);

        expect(data).toHaveProperty('ok', true);
        expect(data.data).toHaveProperty('shift');
    });
});
