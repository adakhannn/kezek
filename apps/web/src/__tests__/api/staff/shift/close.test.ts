jest.mock('@/lib/staffShift/closeSnapshot', () => ({ ...jest.requireActual('@/lib/staffShift/closeSnapshot'), readShiftCloseSnapshot: jest.fn() }));
const { readShiftCloseSnapshot } = jest.requireMock('@/lib/staffShift/closeSnapshot');
import { POST } from '@/app/api/staff/shift/close/route';

jest.mock('@/lib/authBiz', () => ({ getStaffContextForRequest: jest.fn() }));
jest.mock('@/lib/supabaseService', () => ({ getServiceClient: jest.fn() }));
jest.mock('@/lib/rateLimit', () => ({
    checkVerifiedPrincipalRateLimit: jest.fn(async () => ({success: true})), withRateLimit: jest.fn((_req, _config, handler) => handler()), RateLimitConfigs: { critical: {} } }));
jest.mock('@/lib/performanceServer', () => ({ measurePerformance: jest.fn((_operation, fn) => fn()) }));
jest.mock('@/lib/notifications/shiftNotifications', () => ({ sendShiftCloseNotification: jest.fn(() => Promise.resolve()) }));
jest.mock('@/lib/time', () => ({ TZ: 'Asia/Bishkek', formatDateInTz: jest.fn(() => '2024-01-15') }));

import { getStaffContextForRequest } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';
import { sendShiftCloseNotification } from '@/lib/notifications/shiftNotifications';

function query(data: unknown) {
    return {
        select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data, error: null }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve),
    };
}
const supabase = { from: jest.fn(), rpc: jest.fn() };
const admin = { from: jest.fn(), rpc: jest.fn() };
const staff = { percent_master: 60, percent_salon: 40, hourly_rate: 100, full_name: 'Staff', user_id: null };
const openShift = { id: '11111111-1111-4111-8111-111111111111', staff_id: 'staff-id', biz_id: 'biz-id', shift_date: '2024-01-15', status: 'open', opened_at: '2024-01-15T09:00:00Z', ledger_revision: 7 };
const request = (body: unknown) => new Request('http://localhost/api/staff/shift/close', { method: 'POST', body: JSON.stringify({ expectedShiftId: '11111111-1111-4111-8111-111111111111', expectedRevision: 7, ...(body as object) }), headers: { 'Content-Type': 'application/json' } });

function setupRows(shift: unknown = openShift, rows: unknown[] = []) {
    readShiftCloseSnapshot.mockResolvedValue({ shift, staff, items: rows, timezone: 'Asia/Bishkek', dayHours: 24, dayStart: '2024-01-14T18:00Z', closeBoundary: '2024-01-15T18:00Z' });
    supabase.from.mockImplementation((table: string) => {
        if (table === 'staff') return query(staff);
        if (table === 'staff_shifts') return query(shift);
        if (table === 'staff_shift_items') return query(rows);
        throw new Error(`Unexpected table: ${table}`);
    });
}

describe('/api/staff/shift/close', () => {
    beforeEach(() => {
        jest.useFakeTimers().setSystemTime(new Date('2024-01-15T17:00:00Z'));
        jest.clearAllMocks();
        (getStaffContextForRequest as jest.Mock).mockResolvedValue({ supabase, staffId: 'staff-id', bizId: 'biz-id', userId: 'user-id' });
        (getServiceClient as jest.Mock).mockReturnValue(admin);
        setupRows();
        admin.from.mockImplementation(() => query(null));
        admin.rpc.mockReset().mockResolvedValue({ data: { ok: true, action: 'closed', shift: { ...openShift, status: 'closed' } }, error: null });
    });
    afterEach(() => jest.useRealTimers());

    test('closes a zero-amount shift through one service command with actor and revision', async () => {
        const response = await POST(request({ totalAmount: 0, consumablesAmount: 0 }));
        expect(response.status).toBe(200);
        expect((await response.json()).data.shift.status).toBe('closed');
        expect(admin.rpc).toHaveBeenCalledTimes(1);
        expect(admin.rpc).toHaveBeenCalledWith('close_staff_shift_command', {
            p_shift_id: '11111111-1111-4111-8111-111111111111', p_actor_id: 'user-id', p_expected_revision: 7,
            p_expected_settings: { percent_master: 60, percent_salon: 40, hourly_rate: 100 },
            p_calculation: expect.objectContaining({ totalAmount: 0, totalConsumables: 0, closedAt: '2024-01-15T17:00:00.000Z' }),
        });
        expect(supabase.rpc).not.toHaveBeenCalled();
    });

    test('passes the calculated eight-hour guarantee when there are no clients', async () => {
        const response = await POST(request({ totalAmount: 0, consumablesAmount: 0 }));
        expect(response.status).toBe(200);
        expect(admin.rpc).toHaveBeenCalledWith('close_staff_shift_command', expect.objectContaining({
            p_calculation: expect.objectContaining({ hoursWorked: 8, guaranteedAmount: 800, topupAmount: 800, finalMasterShare: 800, finalSalonShare: 0 }),
        }));
    });

    test.each([{ totalAmount: -100 }, { totalAmount: 1000, items: [{ serviceAmount: -50 }] }])('rejects invalid negative financial input %j', async body => {
        const response = await POST(request(body));
        expect(response.status).toBe(400);
        expect((await response.json()).error).toBe('validation');
        expect(admin.rpc).not.toHaveBeenCalled();
    });

    test('returns 400 when no shift exists', async () => {
        setupRows(null);
        const response = await POST(request({ totalAmount: 1000 }));
        expect(response.status).toBe(400);
        expect((await response.json()).error).toBe('validation');
        expect(admin.rpc).not.toHaveBeenCalled();
    });

    test('rejects a submitted snapshot that omits persisted ledger items', async () => {
        setupRows(openShift, [{ id: 'saved-item', service_amount: 1000, consumables_amount: 100, booking_id: null }]);
        const response = await POST(request({ totalAmount: 1000, items: [] }));
        expect(response.status).toBe(409);
        expect(admin.rpc).not.toHaveBeenCalled();
    });

    test('returns 409 when the database revision changed and sends no notification', async () => {
        admin.rpc.mockResolvedValue({ data: null, error: { code: '40001', message: 'SHIFT_STALE' } });
        const response = await POST(request({ totalAmount: 0, items: [] }));
        expect(response.status).toBe(409);
        expect(admin.rpc).toHaveBeenCalledTimes(1);
        expect(sendShiftCloseNotification).not.toHaveBeenCalled();
    });

    test.each([{ expectedRevision: 6 }, { expectedShiftId: '22222222-2222-4222-8222-222222222222' }])(
        'rejects a stale client snapshot before any close command: %j', async version => {
            const response = await POST(request({ totalAmount: 0, ...version }));
            expect(response.status).toBe(409);
            expect(admin.rpc).not.toHaveBeenCalled();
            expect(sendShiftCloseNotification).not.toHaveBeenCalled();
        },
    );
    test.each([{ expectedRevision: undefined }, { expectedShiftId: undefined }])(
        'requires the client snapshot even when the submitted ledger is empty: %j', async version => {
            const response = await POST(request({ totalAmount: 0, ...version }));
            expect(response.status).toBe(400);
            expect(admin.rpc).not.toHaveBeenCalled();
        },
    );

    test('repeated close returns the persisted closed shift without another command', async () => {
        setupRows({ ...openShift, status: 'closed' });
        const response = await POST(request({ totalAmount: 0 }));
        expect(response.status).toBe(200);
        expect((await response.json()).data.shift.status).toBe('closed');
        expect(admin.rpc).not.toHaveBeenCalled();
        expect(sendShiftCloseNotification).not.toHaveBeenCalled();
    });
});
