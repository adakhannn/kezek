import {
    createMockRequest,
    createMockSupabase,
    expectErrorResponse,
    expectSuccessResponse,
    setupApiTestMocks,
} from './testHelpers';

setupApiTestMocks();

const { createClient } = require('@supabase/supabase-js');
const { POST } = require('@/app/api/quick-book-guest/route');

describe('/api/quick-book-guest', () => {
    const mockSupabase = createMockSupabase();
    const validPayload = {
        biz_id: '11111111-1111-4111-8111-111111111111',
        branch_id: '22222222-2222-4222-8222-222222222222',
        service_id: '33333333-3333-4333-8333-333333333333',
        staff_id: '44444444-4444-4444-8444-444444444444',
        start_at: '2026-03-21T10:00:00Z',
        client_name: 'Test User',
        client_phone: '+996555123456',
        client_email: 'test@example.com',
    };

    beforeEach(() => {
        jest.clearAllMocks();

        (createClient as jest.Mock).mockReturnValue(mockSupabase);
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({ ok: true }),
            text: jest.fn().mockResolvedValue(''),
        } as unknown as Response);
    });

    test('returns 400 on invalid request payload', async () => {
        const req = createMockRequest('http://localhost/api/quick-book-guest', {
            method: 'POST',
            body: {
                biz_id: validPayload.biz_id,
            },
        });

        const res = await POST(req);
        await expectErrorResponse(res, 400, 'validation');
    });

    test('creates a guest booking successfully', async () => {
        mockSupabase.from.mockReturnValueOnce({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: { id: validPayload.branch_id },
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

        const req = createMockRequest('http://localhost/api/quick-book-guest', {
            method: 'POST',
            body: validPayload,
        });

        const data = await expectSuccessResponse(await POST(req));
        expect(data.data.booking_id).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
        expect(data.data.confirmed).toBe(true);
        const [notifyUrl, notifyInit] = (global.fetch as jest.Mock).mock.calls[0];
        expect(String(notifyUrl)).toBe('http://localhost/api/notify');
        expect(notifyInit.method).toBe('POST');
    });

    test('returns branch validation error when active branch is missing', async () => {
        mockSupabase.from.mockReturnValueOnce({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: null,
                error: null,
            }),
        });

        const req = createMockRequest('http://localhost/api/quick-book-guest', {
            method: 'POST',
            body: validPayload,
        });

        const data = await expectErrorResponse(await POST(req), 400, 'not_found');
        expect(data.message).toContain('No active branch');
        expect(data.details.code).toBe('no_branch');
    });

    test('returns rpc error when booking hold fails', async () => {
        mockSupabase.from.mockReturnValueOnce({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: { id: validPayload.branch_id },
                error: null,
            }),
        });

        mockSupabase.rpc.mockResolvedValueOnce({
            data: null,
            error: { message: 'Slot conflict' },
        });

        const req = createMockRequest('http://localhost/api/quick-book-guest', {
            method: 'POST',
            body: validPayload,
        });

        const data = await expectErrorResponse(await POST(req), 400, 'validation');
        expect(data.message).toContain('Slot conflict');
        expect(data.details.code).toBe('rpc');
    });
});
