jest.mock('@/lib/staffShift/closeSnapshot', () => ({ ...jest.requireActual('@/lib/staffShift/closeSnapshot'), readShiftCloseSnapshot: jest.fn() }));
const { readShiftCloseSnapshot } = jest.requireMock('@/lib/staffShift/closeSnapshot');
import { runStaffShiftClose } from '@/lib/staffShiftCloseService';

jest.mock('@/lib/performanceServer', () => ({ measurePerformance: (_name: string, fn: () => unknown) => fn() }));
jest.mock('@/lib/log', () => ({ logError: jest.fn(), logDebug: jest.fn() }));
jest.mock('@/lib/notifications/shiftNotifications', () => ({ sendShiftCloseNotification: jest.fn() }));
jest.mock('@/lib/supabaseService', () => ({ getServiceClient: jest.fn() }));
jest.mock('@/lib/time', () => ({
    TZ: 'Asia/Bishkek', formatDateInTz: () => '2026-10-09',
    dateAtTz: () => new Date('2026-10-09T18:00:00Z'),
}));

const { getServiceClient } = jest.requireMock('@/lib/supabaseService');
const row = { id: 'item-1', service_amount: 301, consumables_amount: 49, booking_id: null };
const shift = { id: 'shift-1', staff_id: 'staff-1', biz_id: 'biz-1',
    shift_date: '2026-10-09', status: 'open', ledger_revision: 7, opened_at: '2026-10-08T21:25:00Z' };

function query(result: unknown) {
    const builder: any = { select: jest.fn(), eq: jest.fn(), gte: jest.fn(), lte: jest.fn(),
        neq: jest.fn(), maybeSingle: jest.fn(), then: jest.fn(), delete: jest.fn(), insert: jest.fn() };
    for (const key of ['select', 'eq', 'gte', 'lte']) builder[key].mockReturnValue(builder);
    builder.maybeSingle.mockResolvedValue(result);
    builder.neq.mockResolvedValue(result);
    builder.then.mockImplementation((resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve));
    return builder;
}

function setup(rows = [row], itemsError: unknown = null) {
    const itemQuery = query({ data: rows, error: itemsError });
    if (itemsError) readShiftCloseSnapshot.mockRejectedValue(new Error('ledger unavailable'));
    else readShiftCloseSnapshot.mockResolvedValue({ shift, staff: { percent_master: 60, percent_salon: 40, hourly_rate: null }, items: rows,
        timezone: 'Asia/Bishkek', dayStart: '2026-10-08T18:00Z', closeBoundary: '2026-10-09T18:00Z', dayHours: 24 });
    const supabase = {
        from: jest.fn((table: string) => table === 'staff' ? query({ data: { percent_master: 60, percent_salon: 40 } })
            : table === 'staff_shifts' ? query({ data: shift }) : itemQuery),
        rpc: jest.fn().mockResolvedValue({ data: { ok: true, shift: { ...shift, status: 'closed' } }, error: null }),
    };
    getServiceClient.mockReturnValue({ rpc: supabase.rpc, from: () => query({ data: [], error: null }) });
    return { supabase, itemQuery };
}

const submitted = { id: 'item-1', serviceAmount: 301, consumablesAmount: 49, bookingId: null };
const close = (supabase: any, items: any[]) => runStaffShiftClose({ expectedShiftId: shift.id, expectedRevision: shift.ledger_revision, actorId: 'actor-1', supabase, staffId: 'staff-1', bizId: 'biz-1', items });

describe('staff close finalizes the saved ledger without recreating records', () => {
    beforeEach(() => jest.clearAllMocks());

    test.each(['2026-10-08T23:40:00.000Z','2026-10-09T17:55:00.000Z','2026-10-09T18:05:00.000Z'])(
        'manual staff closure uses action instant bounded by the financial day %s', async instant => {
            jest.useFakeTimers().setSystemTime(new Date(instant));
            try {
                const {supabase} = setup();
                expect(await close(supabase,[submitted])).toMatchObject({ok:true});
                expect(supabase.rpc).toHaveBeenCalledWith('close_staff_shift_command',expect.objectContaining({p_actor_id:'actor-1',p_expected_revision:7,p_calculation:expect.objectContaining({closedAt:new Date(Math.min(Date.parse(instant),Date.parse('2026-10-09T18:00Z'))).toISOString()})}));
            } finally { jest.useRealTimers(); }
        },
    );

    test('uses persisted amounts and never deletes or inserts saved positions', async () => {
        const { supabase, itemQuery } = setup();
        expect(await close(supabase, [submitted])).toMatchObject({ ok: true });
        expect(readShiftCloseSnapshot).toHaveBeenCalledWith(expect.anything(), 'biz-1', 'staff-1', 'shift-1');
        expect(itemQuery.delete).not.toHaveBeenCalled();
        expect(itemQuery.insert).not.toHaveBeenCalled();
        expect(supabase.rpc).toHaveBeenCalledWith('close_staff_shift_command', expect.objectContaining({
            p_expected_revision: 7, p_calculation: expect.objectContaining({totalAmount:301,totalConsumables:49,finalMasterShare:181,finalSalonShare:169}),
        }));
    });

    test.each([
        [{ ...submitted, serviceAmount: 999 }],
        [{ ...submitted, id: 'foreign-item' }],
        [{ ...submitted, bookingId: 'foreign-booking' }],
        [],
        [submitted, submitted],
    ])('rejects unsaved/stale/foreign snapshots before closing: %j', async (...items) => {
        const { supabase } = setup();
        expect(await close(supabase, items)).toMatchObject({ ok: false, statusCode: 409 });
        expect(supabase.rpc).not.toHaveBeenCalled();
    });

    test('read failure cannot close the shift with an empty ledger', async () => {
        const { supabase } = setup([], { message: 'offline' });
        expect(await close(supabase, [])).toMatchObject({ ok: false, statusCode: 500 });
        expect(supabase.rpc).not.toHaveBeenCalled();
    });

    test('legacy snapshot without IDs still uses the persisted ledger', async () => {
        const { supabase } = setup();
        expect(await close(supabase, [{ ...submitted, id: undefined }])).toMatchObject({ ok: true });
    });
});

test('a newer close-read snapshot rejects instead of rebasing the client revision', async () => {
    const { supabase } = setup();
    const original = await readShiftCloseSnapshot();
    readShiftCloseSnapshot.mockResolvedValue({ ...original, shift: { ...shift, ledger_revision: 8 } });
    expect(await close(supabase, [submitted])).toMatchObject({ ok: false, statusCode: 409 });
    expect(supabase.rpc).not.toHaveBeenCalled();
});
