import { POST } from '@/app/api/staff/shift/close/route';

jest.mock('@/lib/authBiz', () => ({
    getStaffContextForRequest: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

jest.mock('@/lib/rateLimit', () => ({
    withRateLimit: jest.fn((req, config, handler) => handler()),
    RateLimitConfigs: {
        critical: {},
    },
}));

jest.mock('@/lib/performance', () => ({
    measurePerformance: jest.fn((_operation, fn) => fn()),
}));

jest.mock('@/lib/notifications/shiftNotifications', () => ({
    sendShiftCloseNotification: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/lib/time', () => ({
    TZ: 'Asia/Bishkek',
    formatDateInTz: jest.fn(() => '2024-01-15'),
    dateAtTz: jest.fn((date: string, time: string) => new Date(`${date}T${time}:00Z`)),
}));

import { getStaffContextForRequest } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';

function createDoubleEqUpdateResult() {
    const query = {
        update: jest.fn(),
        eq: jest.fn(),
    };
    query.update.mockReturnValue(query);
    query.eq
        .mockImplementationOnce(() => query)
        .mockResolvedValueOnce({
            data: null,
            error: null,
        });
    return query;
}

function createAdminQueryResult({
    maybeSingleData = null,
    listData = [],
}: {
    maybeSingleData?: unknown;
    listData?: unknown[];
} = {}) {
    const query = {
        select: jest.fn(),
        eq: jest.fn(),
        gte: jest.fn(),
        lte: jest.fn(),
        neq: jest.fn(),
        in: jest.fn(),
        maybeSingle: jest.fn(),
        update: jest.fn(),
    };

    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.gte.mockReturnValue(query);
    query.lte.mockReturnValue(query);
    query.update.mockReturnValue(query);
    query.maybeSingle.mockResolvedValue({
        data: maybeSingleData,
        error: null,
    });
    query.in.mockResolvedValue({
        data: listData,
        error: null,
    });
    query.neq.mockResolvedValue({
        data: listData,
        error: null,
    });

    return query;
}

describe('/api/staff/shift/close', () => {
    const mockSupabase = {
        auth: {
            getUser: jest.fn(),
        },
        from: jest.fn(),
        rpc: jest.fn(),
    };

    const mockAdmin = {
        from: jest.fn(),
        rpc: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockSupabase.auth.getUser.mockReset();
        mockSupabase.from.mockReset();
        mockSupabase.rpc.mockReset();
        mockAdmin.from.mockReset();
        mockAdmin.rpc.mockReset();

        mockSupabase.auth.getUser.mockResolvedValue({
            data: {
                user: {
                    id: 'user-uuid',
                },
            },
        });
        (mockAdmin as unknown as {
            auth?: { admin?: { getUserById?: jest.Mock } };
        }).auth = {
            admin: {
                getUserById: jest.fn().mockResolvedValue({
                    data: {
                        user: {
                            email: null,
                        },
                    },
                }),
            },
        };

        (getStaffContextForRequest as jest.Mock).mockResolvedValue({
            supabase: mockSupabase,
            staffId: 'test-staff-id',
            bizId: 'test-biz-id',
            branchId: '11111111-1111-4111-8111-111111111111',
        });

        mockAdmin.from.mockImplementation((table: string) => {
            if (table === 'businesses') {
                return createAdminQueryResult({
                    maybeSingleData: null,
                });
            }

            if (table === 'bookings') {
                return createAdminQueryResult({
                    listData: [],
                });
            }

            return createAdminQueryResult();
        });
        mockAdmin.rpc.mockResolvedValue({
            error: null,
        });

        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);
    });

    test('closes shift with zero amount', async () => {
        mockSupabase.from
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        percent_master: 60,
                        percent_salon: 40,
                        hourly_rate: 100,
                        full_name: 'Staff',
                        user_id: null,
                    },
                    error: null,
                }),
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: 'shift-id',
                        staff_id: 'test-staff-id',
                        biz_id: 'test-biz-id',
                        shift_date: '2024-01-15',
                        status: 'open',
                        opened_at: '2024-01-15T09:00:00Z',
                        total_amount: 0,
                        consumables_amount: 0,
                        percent_master: 60,
                        percent_salon: 40,
                        master_share: 0,
                        salon_share: 0,
                        hours_worked: null,
                        hourly_rate: 100,
                        guaranteed_amount: 0,
                        topup_amount: 0,
                    },
                    error: null,
                }),
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                not: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                }),
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

        mockSupabase.rpc.mockResolvedValue({
            data: {
                ok: true,
                shift: {
                    id: 'shift-id',
                    status: 'closed',
                },
            },
            error: null,
        });

        const req = new Request('http://localhost/api/staff/shift/close', {
            method: 'POST',
            body: JSON.stringify({
                totalAmount: 0,
                consumablesAmount: 0,
            }),
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.ok).toBe(true);
        expect(data.data.shift.status).toBe('closed');
        expect(mockSupabase.rpc).toHaveBeenCalledWith(
            'close_staff_shift_safe',
            expect.objectContaining({
                p_total_amount: 0,
            }),
        );
    });

    test('passes guaranteed amount when there are no clients', async () => {
        mockSupabase.from
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        percent_master: 60,
                        percent_salon: 40,
                        hourly_rate: 100,
                        full_name: 'Staff',
                        user_id: null,
                    },
                    error: null,
                }),
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: 'shift-id',
                        staff_id: 'test-staff-id',
                        biz_id: 'test-biz-id',
                        shift_date: '2024-01-15',
                        status: 'open',
                        opened_at: '2024-01-15T09:00:00Z',
                        total_amount: 0,
                        consumables_amount: 0,
                        percent_master: 60,
                        percent_salon: 40,
                        master_share: 0,
                        salon_share: 0,
                        hours_worked: null,
                        hourly_rate: 100,
                        guaranteed_amount: 0,
                        topup_amount: 0,
                    },
                    error: null,
                }),
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                not: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                }),
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

        mockSupabase.rpc.mockResolvedValue({
            data: {
                ok: true,
                shift: {
                    id: 'shift-id',
                    status: 'closed',
                    master_share: 800,
                },
            },
            error: null,
        });

        const req = new Request('http://localhost/api/staff/shift/close', {
            method: 'POST',
            body: JSON.stringify({
                totalAmount: 0,
                consumablesAmount: 0,
            }),
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.ok).toBe(true);
        expect(mockSupabase.rpc).toHaveBeenCalledWith(
            'close_staff_shift_safe',
            expect.objectContaining({
                p_guaranteed_amount: expect.any(Number),
            }),
        );
    });

    test('returns 400 for negative totals', async () => {
        const req = new Request('http://localhost/api/staff/shift/close', {
            method: 'POST',
            body: JSON.stringify({
                totalAmount: -100,
                consumablesAmount: 0,
            }),
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.ok).toBe(false);
        expect(data.error).toBe('validation');
    });

    test('returns 400 for invalid negative item amount', async () => {
        const req = new Request('http://localhost/api/staff/shift/close', {
            method: 'POST',
            body: JSON.stringify({
                totalAmount: 1000,
                items: [{ serviceAmount: -50 }],
            }),
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.ok).toBe(false);
        expect(data.error).toBe('validation');
    });

    test('returns 400 when no open shift exists', async () => {
        mockSupabase.from
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        percent_master: 60,
                        percent_salon: 40,
                        hourly_rate: 100,
                        full_name: 'Staff',
                        user_id: 'user-uuid',
                    },
                    error: null,
                }),
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

        const req = new Request('http://localhost/api/staff/shift/close', {
            method: 'POST',
            body: JSON.stringify({
                totalAmount: 1000,
                consumablesAmount: 0,
            }),
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.ok).toBe(false);
        expect(data.error).toBe('validation');
    });
});
