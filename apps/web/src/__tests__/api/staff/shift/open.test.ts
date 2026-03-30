import { POST } from '@/app/api/staff/shift/open/route';

jest.mock('@/lib/authBiz', () => ({
    getStaffContext: jest.fn(),
}));

jest.mock('@/lib/rateLimit', () => ({
    withRateLimit: jest.fn((req, config, handler) => handler()),
    RateLimitConfigs: {
        critical: {},
    },
}));

jest.mock('@/lib/time', () => ({
    todayTz: jest.fn(() => new Date('2024-01-15T10:00:00Z')),
    dateAtTz: jest.fn((date: string, time: string) => new Date(`${date}T${time}:00Z`)),
    formatDateInTz: jest.fn(() => '2024-01-15'),
    TZ: 'Asia/Bishkek',
}));

import { getStaffContext } from '@/lib/authBiz';

type QueryResult = { data: unknown; error: unknown };

function createAwaitableQuery(result: QueryResult, resolver: 'gte' | 'maybeSingle') {
    const query: Record<string, jest.Mock | ((resolve: (value: QueryResult) => unknown) => unknown)> = {};
    query.select = jest.fn(() => query);
    query.eq = jest.fn(() => query);
    query.lte = jest.fn(() => query);
    query.gte = jest.fn(() => (resolver === 'gte' ? Promise.resolve(result) : query));
    query.maybeSingle = jest.fn(() =>
        resolver === 'maybeSingle' ? Promise.resolve(result) : Promise.resolve(result),
    );
    return query;
}

describe('/api/staff/shift/open', () => {
    const mockSupabase = {
        auth: {
            getUser: jest.fn(),
        },
        from: jest.fn(),
        rpc: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();

        mockSupabase.auth.getUser.mockResolvedValue({
            data: {
                user: {
                    id: 'user-uuid',
                },
            },
        });

        (getStaffContext as jest.Mock).mockResolvedValue({
            supabase: mockSupabase,
            staffId: 'test-staff-id',
            bizId: 'test-biz-id',
            branchId: '11111111-1111-4111-8111-111111111111',
        });
    });

    test('opens shift when date-specific schedule exists', async () => {
        mockSupabase.from
            .mockReturnValueOnce(createAwaitableQuery({ data: [], error: null }, 'gte'))
            .mockReturnValueOnce(
                createAwaitableQuery(
                    {
                        data: {
                            intervals: [{ start: '09:00', end: '18:00' }],
                            is_active: true,
                        },
                        error: null,
                    },
                    'maybeSingle',
                ),
            );

        mockSupabase.rpc.mockResolvedValue({
            data: {
                ok: true,
                action: 'created',
                shift: {
                    id: 'new-shift-id',
                    shift_date: '2024-01-15',
                    status: 'open',
                    opened_at: '2024-01-15T10:00:00Z',
                },
            },
            error: null,
        });

        const response = await POST(new Request('http://localhost/api/staff/shift/open', { method: 'POST' }));
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.ok).toBe(true);
        expect(data.data.shift).toHaveProperty('id', 'new-shift-id');
    });

    test('falls back to weekly schedule when no date rule exists', async () => {
        mockSupabase.from
            .mockReturnValueOnce(createAwaitableQuery({ data: [], error: null }, 'gte'))
            .mockReturnValueOnce(createAwaitableQuery({ data: null, error: null }, 'maybeSingle'))
            .mockReturnValueOnce(
                createAwaitableQuery(
                    {
                        data: {
                            intervals: [{ start: '10:00', end: '19:00' }],
                        },
                        error: null,
                    },
                    'maybeSingle',
                ),
            );

        mockSupabase.rpc.mockResolvedValue({
            data: {
                ok: true,
                action: 'created',
                shift: {
                    id: 'new-shift-id',
                    shift_date: '2024-01-15',
                    status: 'open',
                },
            },
            error: null,
        });

        const response = await POST(new Request('http://localhost/api/staff/shift/open', { method: 'POST' }));
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.ok).toBe(true);
    });

    test('returns 400 on day off from staff_time_off', async () => {
        mockSupabase.from.mockReturnValueOnce(
            createAwaitableQuery(
                {
                    data: [{ id: 'time-off-id' }],
                    error: null,
                },
                'gte',
            ),
        );

        const response = await POST(new Request('http://localhost/api/staff/shift/open', { method: 'POST' }));
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.ok).toBe(false);
        expect(data.error).toBe('validation');
    });

    test('returns 400 when there are no working hours', async () => {
        mockSupabase.from
            .mockReturnValueOnce(createAwaitableQuery({ data: [], error: null }, 'gte'))
            .mockReturnValueOnce(createAwaitableQuery({ data: null, error: null }, 'maybeSingle'))
            .mockReturnValueOnce(createAwaitableQuery({ data: null, error: null }, 'maybeSingle'));

        const response = await POST(new Request('http://localhost/api/staff/shift/open', { method: 'POST' }));
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.ok).toBe(false);
        expect(data.error).toBe('validation');
    });

    test('returns 500 when RPC returns logical failure', async () => {
        mockSupabase.from
            .mockReturnValueOnce(createAwaitableQuery({ data: [], error: null }, 'gte'))
            .mockReturnValueOnce(
                createAwaitableQuery(
                    {
                        data: {
                            intervals: [{ start: '09:00', end: '18:00' }],
                            is_active: true,
                        },
                        error: null,
                    },
                    'maybeSingle',
                ),
            );

        mockSupabase.rpc.mockResolvedValue({
            data: {
                ok: false,
                error: 'Смена уже открыта на эту дату',
            },
            error: null,
        });

        const response = await POST(new Request('http://localhost/api/staff/shift/open', { method: 'POST' }));
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.ok).toBe(false);
        expect(data.error).toBe('internal');
        expect(data.message).toContain('Смена уже открыта');
    });

    test('returns 500 when RPC returns database error', async () => {
        mockSupabase.from
            .mockReturnValueOnce(createAwaitableQuery({ data: [], error: null }, 'gte'))
            .mockReturnValueOnce(
                createAwaitableQuery(
                    {
                        data: {
                            intervals: [{ start: '09:00', end: '18:00' }],
                            is_active: true,
                        },
                        error: null,
                    },
                    'maybeSingle',
                ),
            );

        mockSupabase.rpc.mockResolvedValue({
            data: null,
            error: {
                message: 'Database error',
                code: 'PGRST301',
            },
        });

        const response = await POST(new Request('http://localhost/api/staff/shift/open', { method: 'POST' }));
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.ok).toBe(false);
        expect(data.error).toBe('internal');
    });

    test('returns 401 when auth context loading fails', async () => {
        (getStaffContext as jest.Mock).mockRejectedValue(new Error('UNAUTHORIZED'));

        const response = await POST(new Request('http://localhost/api/staff/shift/open', { method: 'POST' }));
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.ok).toBe(false);
        expect(data.error).toBe('auth');
    });

    test('passes late minutes into RPC', async () => {
        mockSupabase.from
            .mockReturnValueOnce(createAwaitableQuery({ data: [], error: null }, 'gte'))
            .mockReturnValueOnce(
                createAwaitableQuery(
                    {
                        data: {
                            intervals: [{ start: '09:00', end: '18:00' }],
                            is_active: true,
                        },
                        error: null,
                    },
                    'maybeSingle',
                ),
            );

        mockSupabase.rpc.mockResolvedValue({
            data: {
                ok: true,
                action: 'created',
                shift: {
                    id: 'new-shift-id',
                    shift_date: '2024-01-15',
                    status: 'open',
                    late_minutes: 60,
                },
            },
            error: null,
        });

        const response = await POST(new Request('http://localhost/api/staff/shift/open', { method: 'POST' }));
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.ok).toBe(true);
        expect(mockSupabase.rpc).toHaveBeenCalledWith(
            'open_staff_shift_safe',
            expect.objectContaining({
                p_late_minutes: expect.any(Number),
            }),
        );
    });
});
