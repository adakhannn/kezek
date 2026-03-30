import {
    createMockRequest,
    createMockSupabase,
    expectErrorResponse,
    expectSuccessResponse,
    setupApiTestMocks,
} from './testHelpers';

setupApiTestMocks();

const { createClient } = require('@supabase/supabase-js');
const { createServerClient } = require('@supabase/ssr');
const { POST } = require('@/app/api/quick-hold/route');

describe('/api/quick-hold', () => {
    const mockSupabase = createMockSupabase();
    const validPayload = {
        biz_id: '11111111-1111-4111-8111-111111111111',
        service_id: '33333333-3333-4333-8333-333333333333',
        staff_id: '44444444-4444-4444-8444-444444444444',
        start_at: '2026-03-21T10:00:00Z',
    };

    beforeEach(() => {
        jest.clearAllMocks();

        (createServerClient as jest.Mock).mockReturnValue(mockSupabase);
        (createClient as jest.Mock).mockReturnValue(mockSupabase);
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-id-123' } },
            error: null,
        });

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({ ok: true }),
            text: jest.fn().mockResolvedValue(''),
        } as unknown as Response);
    });

    test('returns 401 when user is not authenticated', async () => {
        mockSupabase.auth.getUser.mockResolvedValueOnce({
            data: { user: null },
            error: null,
        });

        const res = await POST(
            createMockRequest('http://localhost/api/quick-hold', {
                method: 'POST',
                body: validPayload,
            }),
        );

        await expectErrorResponse(res, 401, 'auth');
    });

    test('creates hold booking successfully', async () => {
        mockSupabase.from.mockReturnValueOnce({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: { id: '22222222-2222-4222-8222-222222222222' },
                error: null,
            }),
        });

        mockSupabase.rpc
            .mockResolvedValueOnce({
                data: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                error: null,
            })
            .mockResolvedValueOnce({
                data: { ok: true },
                error: null,
            });

        const data = await expectSuccessResponse(
            await POST(
                createMockRequest('http://localhost/api/quick-hold', {
                    method: 'POST',
                    body: validPayload,
                }),
            ),
        );

        expect(data.data.booking_id).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
        expect(data.data.confirmed).toBe(true);
    });

    test('returns mapped validation error when branch is missing', async () => {
        mockSupabase.from.mockReturnValueOnce({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: null,
                error: null,
            }),
        });

        const data = await expectErrorResponse(
            await POST(
                createMockRequest('http://localhost/api/quick-hold', {
                    method: 'POST',
                    body: validPayload,
                }),
            ),
            400,
            'validation',
        );

        expect(data.details.kind).toBe('NO_ACTIVE_BRANCH_FOR_BIZ');
    });

    test('supports bearer auth requests', async () => {
        mockSupabase.from.mockReturnValueOnce({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: { id: '22222222-2222-4222-8222-222222222222' },
                error: null,
            }),
        });

        mockSupabase.rpc
            .mockResolvedValueOnce({
                data: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                error: null,
            })
            .mockResolvedValueOnce({
                data: { ok: true },
                error: null,
            });

        const req = createMockRequest('http://localhost/api/quick-hold', {
            method: 'POST',
            body: validPayload,
            headers: {
                Authorization: 'Bearer test-token',
            },
        });

        const data = await expectSuccessResponse(await POST(req));
        expect(data.data.booking_id).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
        expect(createClient).toHaveBeenCalled();
    });
});
