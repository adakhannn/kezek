import { runStaffShiftClose } from '@/lib/staffShiftCloseService';

jest.mock('@/lib/performance', () => ({ measurePerformance: (_name: string, fn: () => unknown) => fn() }));
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
    shift_date: '2026-10-09', status: 'open', opened_at: '2026-10-08T21:25:00Z' };

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
    const supabase = {
        from: jest.fn((table: string) => table === 'staff' ? query({ data: { percent_master: 60, percent_salon: 40 } })
            : table === 'staff_shifts' ? query({ data: shift }) : itemQuery),
        rpc: jest.fn().mockResolvedValue({ data: { ok: true, shift: { ...shift, status: 'closed' } }, error: null }),
    };
    getServiceClient.mockReturnValue({ from: () => query({ data: [], error: null }) });
    return { supabase, itemQuery };
}

const submitted = { id: 'item-1', serviceAmount: 301, consumablesAmount: 49, bookingId: null };
const close = (supabase: any, items: any[]) => runStaffShiftClose({ supabase, staffId: 'staff-1', bizId: 'biz-1', items });

describe('staff close finalizes the saved ledger without recreating records', () => {
    beforeEach(() => jest.clearAllMocks());

    test.each(['2026-10-08T23:40:00.000Z','2026-10-09T17:55:00.000Z','2026-10-09T18:05:00.000Z'])(
        'manual staff closure records the actual action instant %s', async instant => {
            jest.useFakeTimers().setSystemTime(new Date(instant));
            try {
                const {supabase} = setup();
                expect(await close(supabase,[submitted])).toMatchObject({ok:true});
                expect(supabase.rpc).toHaveBeenCalledWith('close_staff_shift_safe',expect.objectContaining({p_closed_at:instant}));
            } finally { jest.useRealTimers(); }
        },
    );

    test('uses persisted amounts and never deletes or inserts saved positions', async () => {
        const { supabase, itemQuery } = setup();
        expect(await close(supabase, [submitted])).toMatchObject({ ok: true });
        expect(itemQuery.eq).toHaveBeenCalledWith('shift_id', 'shift-1');
        expect(itemQuery.delete).not.toHaveBeenCalled();
        expect(itemQuery.insert).not.toHaveBeenCalled();
        expect(supabase.rpc).toHaveBeenCalledWith('close_staff_shift_safe', expect.objectContaining({
            p_total_amount: 301, p_consumables_amount: 49, p_master_share: 181, p_salon_share: 169,
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
