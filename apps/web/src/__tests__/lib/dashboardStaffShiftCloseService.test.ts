import { runDashboardStaffShiftClose } from '@/lib/dashboardStaffShiftCloseService';

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
    query.maybeSingle.mockResolvedValue({ data: maybeSingleData, error: null });
    query.in.mockResolvedValue({ data: listData, error: null });
    query.order.mockResolvedValue({ data: listData, error: null });
    query.not.mockResolvedValue({ data: listData, error: null });
    query.neq.mockResolvedValue({ data: listData, error: null });
    query.insert.mockResolvedValue({ data: null, error: null });

    return query;
}

describe('dashboardStaffShiftCloseService', () => {
    const staffId = 'staff-id';
    const bizId = 'biz-id';
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
        admin.from.mockImplementation((table: string) => {
            if (table === 'businesses' || table === 'bookings' || table === 'staff_shift_items') {
                return createAdminQueryResult({ listData: [] });
            }
            return createAdminQueryResult();
        });
        admin.rpc.mockResolvedValue({ error: null });
        admin.auth.admin.getUserById.mockResolvedValue({ data: { user: { email: null } } });
    });

    test('returns forbidden for staff business mismatch', async () => {
        admin.from.mockReturnValueOnce(
            createAdminQueryResult({
                maybeSingleData: {
                    id: staffId,
                    biz_id: 'other-biz',
                    full_name: 'Staff',
                    percent_master: 60,
                    percent_salon: 40,
                    hourly_rate: 100,
                    user_id: null,
                },
            }),
        );

        const result = await runDashboardStaffShiftClose({
            req: new Request('http://localhost/api/dashboard/staff/staff-id/shift/close?date=2024-01-15', {
                method: 'POST',
                body: JSON.stringify({ totalAmount: 0, items: [] }),
                headers: { 'content-type': 'application/json' },
            }),
            admin,
            bizId,
            staffId,
        });

        expect(result).toEqual({
            ok: false,
            statusCode: 403,
            errorType: 'forbidden',
            message: 'РЎРѕС‚СЂСѓРґРЅРёРє РЅРµ РїСЂРёРЅР°РґР»РµР¶РёС‚ СЌС‚РѕРјСѓ Р±РёР·РЅРµСЃСѓ',
        });
    });
});
