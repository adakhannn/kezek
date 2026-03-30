import { POST } from '@/app/api/dashboard/staff/[id]/shift/close/route';
import {
    createMockRequest,
    expectErrorResponse,
    expectSuccessResponse,
    setupApiTestMocks,
} from '../../testHelpers';

setupApiTestMocks();

jest.mock('@/lib/withManagerContext', () => ({
    withManagerContext: jest.fn(),
}));

jest.mock('@/lib/routeParams', () => ({
    getRouteParamUuid: jest.fn(),
}));

jest.mock('@/lib/rateLimit', () => ({
    withRateLimit: jest.fn((_req, _config, handler) => handler()),
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

import { getRouteParamUuid } from '@/lib/routeParams';
import { withManagerContext } from '@/lib/withManagerContext';

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
        order: jest.fn(),
        not: jest.fn(),
        delete: jest.fn(),
        insert: jest.fn(),
        update: jest.fn(),
    };

    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.gte.mockReturnValue(query);
    query.lte.mockReturnValue(query);
    query.delete.mockReturnValue(query);
    query.update.mockReturnValue(query);
    query.maybeSingle.mockResolvedValue({
        data: maybeSingleData,
        error: null,
    });
    query.in.mockResolvedValue({
        data: listData,
        error: null,
    });
    query.order.mockResolvedValue({
        data: listData,
        error: null,
    });
    query.not.mockResolvedValue({
        data: listData,
        error: null,
    });
    query.neq.mockResolvedValue({
        data: listData,
        error: null,
    });
    query.insert.mockResolvedValue({
        data: null,
        error: null,
    });

    return query;
}

describe('/api/dashboard/staff/[id]/shift/close', () => {
    const staffId = '11111111-2222-3333-4444-555555555555';
    const bizId = 'biz-uuid-1111-2222-3333-4444-555555555555';
    const admin = {
        from: jest.fn(),
        rpc: jest.fn(),
        auth: {
            admin: {
                getUserById: jest.fn(),
            },
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        admin.from.mockReset();
        admin.rpc.mockReset();
        admin.auth.admin.getUserById.mockReset();

        (getRouteParamUuid as jest.Mock).mockResolvedValue(staffId);
        (withManagerContext as jest.Mock).mockImplementation(
            async (_req: Request, _scope: string, callback: (args: { admin: typeof admin; bizId: string }) => Promise<Response>) =>
                callback({
                    admin,
                    bizId,
                }),
        );

        admin.from.mockImplementation((table: string) => {
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

            if (table === 'staff_shift_items') {
                return createAdminQueryResult({
                    listData: [],
                });
            }

            return createAdminQueryResult();
        });

        admin.rpc.mockResolvedValue({
            error: null,
        });
        admin.auth.admin.getUserById.mockResolvedValue({
            data: {
                user: {
                    email: null,
                },
            },
        });
    });

    test('returns 400 for invalid date query', async () => {
        admin.from.mockReturnValueOnce(
            createAdminQueryResult({
                maybeSingleData: {
                    id: staffId,
                    biz_id: bizId,
                    full_name: 'Staff',
                    percent_master: 60,
                    percent_salon: 40,
                    hourly_rate: 100,
                    user_id: null,
                },
            }),
        );

        const req = createMockRequest(`http://localhost/api/dashboard/staff/${staffId}/shift/close?date=invalid`, {
            method: 'POST',
            body: { totalAmount: 0, items: [] },
        });

        const res = await POST(req, { params: Promise.resolve({ id: staffId }) });
        await expectErrorResponse(res, 400, 'validation');
    });

    test('returns 404 when staff is not found', async () => {
        admin.from.mockReturnValueOnce(
            createAdminQueryResult({
                maybeSingleData: null,
            }),
        );

        const req = createMockRequest(`http://localhost/api/dashboard/staff/${staffId}/shift/close?date=2024-01-15`, {
            method: 'POST',
            body: { totalAmount: 0, items: [] },
        });

        const res = await POST(req, { params: Promise.resolve({ id: staffId }) });
        await expectErrorResponse(res, 404, 'not_found');
    });

    test('returns 403 when staff belongs to another business', async () => {
        admin.from.mockReturnValueOnce(
            createAdminQueryResult({
                maybeSingleData: {
                    id: staffId,
                    biz_id: 'other-biz-id',
                    full_name: 'Staff',
                    percent_master: 60,
                    percent_salon: 40,
                    hourly_rate: 100,
                    user_id: null,
                },
            }),
        );

        const req = createMockRequest(`http://localhost/api/dashboard/staff/${staffId}/shift/close?date=2024-01-15`, {
            method: 'POST',
            body: { totalAmount: 0, items: [] },
        });

        const res = await POST(req, { params: Promise.resolve({ id: staffId }) });
        await expectErrorResponse(res, 403, 'forbidden');
    });

    test('returns 400 for negative total amount', async () => {
        admin.from.mockReturnValueOnce(
            createAdminQueryResult({
                maybeSingleData: {
                    id: staffId,
                    biz_id: bizId,
                    full_name: 'Staff',
                    percent_master: 60,
                    percent_salon: 40,
                    hourly_rate: 100,
                    user_id: null,
                },
            }),
        );

        const req = createMockRequest(`http://localhost/api/dashboard/staff/${staffId}/shift/close?date=2024-01-15`, {
            method: 'POST',
            body: { totalAmount: -100, items: [] },
        });

        const res = await POST(req, { params: Promise.resolve({ id: staffId }) });
        await expectErrorResponse(res, 400, 'validation');
    });

    test('returns 400 when no shift is open for the selected date', async () => {
        admin.from
            .mockReturnValueOnce(
                createAdminQueryResult({
                    maybeSingleData: {
                        id: staffId,
                        biz_id: bizId,
                        full_name: 'Staff',
                        percent_master: 60,
                        percent_salon: 40,
                        hourly_rate: 100,
                        user_id: null,
                    },
                }),
            )
            .mockReturnValueOnce(
                createAdminQueryResult({
                    maybeSingleData: null,
                }),
            );

        const req = createMockRequest(`http://localhost/api/dashboard/staff/${staffId}/shift/close?date=2024-01-15`, {
            method: 'POST',
            body: { totalAmount: 1000, items: [] },
        });

        const res = await POST(req, { params: Promise.resolve({ id: staffId }) });
        await expectErrorResponse(res, 400, 'validation');
    });

    test('returns 400 when shift is already closed', async () => {
        admin.from
            .mockReturnValueOnce(
                createAdminQueryResult({
                    maybeSingleData: {
                        id: staffId,
                        biz_id: bizId,
                        full_name: 'Staff',
                        percent_master: 60,
                        percent_salon: 40,
                        hourly_rate: 100,
                        user_id: null,
                    },
                }),
            )
            .mockReturnValueOnce(
                createAdminQueryResult({
                    maybeSingleData: {
                        id: 'shift-id',
                        staff_id: staffId,
                        biz_id: bizId,
                        shift_date: '2024-01-15',
                        status: 'closed',
                        opened_at: '2024-01-15T09:00:00Z',
                        closed_at: '2024-01-15T18:00:00Z',
                    },
                }),
            );

        const req = createMockRequest(`http://localhost/api/dashboard/staff/${staffId}/shift/close?date=2024-01-15`, {
            method: 'POST',
            body: { totalAmount: 1000, items: [] },
        });

        const res = await POST(req, { params: Promise.resolve({ id: staffId }) });
        await expectErrorResponse(res, 400, 'validation');
    });

    test('closes dashboard shift with totalAmount payload', async () => {
        admin.from
            .mockReturnValueOnce(
                createAdminQueryResult({
                    maybeSingleData: {
                        id: staffId,
                        biz_id: bizId,
                        full_name: 'Staff',
                        percent_master: 60,
                        percent_salon: 40,
                        hourly_rate: 100,
                        user_id: null,
                    },
                }),
            )
            .mockReturnValueOnce(
                createAdminQueryResult({
                    maybeSingleData: {
                        id: 'shift-id',
                        staff_id: staffId,
                        biz_id: bizId,
                        shift_date: '2024-01-15',
                        status: 'open',
                        opened_at: '2024-01-15T09:00:00Z',
                        closed_at: null,
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
                }),
            );

        admin.rpc.mockResolvedValue({
            data: {
                ok: true,
                shift: {
                    id: 'shift-id',
                    staff_id: staffId,
                    biz_id: bizId,
                    shift_date: '2024-01-15',
                    status: 'closed',
                    opened_at: '2024-01-15T09:00:00Z',
                    closed_at: '2024-01-16T00:00:00Z',
                    total_amount: 1000,
                    consumables_amount: 0,
                    percent_master: 60,
                    percent_salon: 40,
                    master_share: 600,
                    salon_share: 400,
                    hours_worked: 8,
                    hourly_rate: 100,
                    guaranteed_amount: 0,
                    topup_amount: 0,
                },
            },
            error: null,
        });

        const req = createMockRequest(`http://localhost/api/dashboard/staff/${staffId}/shift/close?date=2024-01-15`, {
            method: 'POST',
            body: { totalAmount: 1000, consumablesAmount: 0, items: [] },
        });

        const res = await POST(req, { params: Promise.resolve({ id: staffId }) });
        const data = await expectSuccessResponse(res, 200);

        expect(data.data.shift.status).toBe('closed');
        expect(admin.rpc).toHaveBeenCalledWith(
            'close_staff_shift_safe',
            expect.objectContaining({
                p_shift_id: 'shift-id',
                p_total_amount: 1000,
            }),
        );
    });

    test('closes dashboard shift with items payload', async () => {
        admin.from
            .mockReturnValueOnce(
                createAdminQueryResult({
                    maybeSingleData: {
                        id: staffId,
                        biz_id: bizId,
                        full_name: 'Staff',
                        percent_master: 60,
                        percent_salon: 40,
                        hourly_rate: 100,
                        user_id: null,
                    },
                }),
            )
            .mockReturnValueOnce(
                createAdminQueryResult({
                    maybeSingleData: {
                        id: 'shift-id',
                        staff_id: staffId,
                        biz_id: bizId,
                        shift_date: '2024-01-15',
                        status: 'open',
                        opened_at: '2024-01-15T09:00:00Z',
                        closed_at: null,
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
                }),
            );

        admin.rpc.mockResolvedValue({
            data: {
                ok: true,
                shift: {
                    id: 'shift-id',
                    staff_id: staffId,
                    biz_id: bizId,
                    shift_date: '2024-01-15',
                    status: 'closed',
                    opened_at: '2024-01-15T09:00:00Z',
                    closed_at: '2024-01-16T00:00:00Z',
                    total_amount: 1000,
                    consumables_amount: 100,
                    percent_master: 60,
                    percent_salon: 40,
                    master_share: 540,
                    salon_share: 360,
                    hours_worked: 8,
                    hourly_rate: 100,
                    guaranteed_amount: 0,
                    topup_amount: 0,
                },
            },
            error: null,
        });

        const req = createMockRequest(`http://localhost/api/dashboard/staff/${staffId}/shift/close?date=2024-01-15`, {
            method: 'POST',
            body: {
                items: [
                    {
                        clientName: 'Client 1',
                        serviceName: 'Haircut',
                        serviceAmount: 1000,
                        consumablesAmount: 100,
                        bookingId: null,
                    },
                ],
            },
        });

        const res = await POST(req, { params: Promise.resolve({ id: staffId }) });
        const data = await expectSuccessResponse(res, 200);

        expect(data.data.shift.status).toBe('closed');
    });
});
