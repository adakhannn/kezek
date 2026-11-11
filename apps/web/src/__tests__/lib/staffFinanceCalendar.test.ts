import { runOpenStaffShift } from '@/lib/staffShiftOpenService';
import { runSaveStaffShiftItems } from '@/lib/staffShiftItemsService';
import { readFinanceCalendar } from '@/lib/finance/calendar';
jest.mock('@/lib/scheduling/config', () => ({ explicitSchedulingEnabled: () => false }));
jest.mock('@/lib/log', () => ({ logWarn: jest.fn(), logError: jest.fn(), logDebug: jest.fn() }));
const calendar = { date: '2026-11-08', todayDate: '2026-11-08', timezone: 'America/New_York', dayStart: '2026-11-08T05:00Z', dayEnd: '2026-11-09T05:00Z', dayHours: 24 };
function setup() {
    const queries: { table: string; eq: jest.Mock }[] = [];
    const client = { rpc: jest.fn(async (name: string) => ({ data: name === 'read_staff_finance_calendar' ? calendar : { ok: true, shift: { id: 'shift' } }, error: null })), from: jest.fn((table: string) => {
        const builder: any = { select: jest.fn(() => builder), eq: jest.fn(() => builder), is: jest.fn(() => builder), lte: jest.fn(() => builder), gte: jest.fn(async () => ({ data: [], error: null })), maybeSingle: jest.fn(async () => ({ data: table === 'working_hours' ? { intervals: [{ start: '09:00', end: '18:00' }] } : null, error: null })) }; queries.push({ table, eq: builder.eq }); return builder;
    }) };
    return { client, queries };
}
test('Open uses business date/weekday and actual timezone for schedule start when UTC day differs', async () => {
    const { client, queries } = setup();
    const result = await runOpenStaffShift({ supabase: client as never, staffId: 'staff', bizId: 'biz', branchId: 'branch', now: new Date('2026-11-09T02:00Z') });
    expect(result.ok).toBe(true);
    expect(queries.find(q => q.table === 'working_hours')?.eq).toHaveBeenCalledWith('day_of_week',0);
    expect(client.rpc).toHaveBeenCalledWith('open_staff_shift_safe', expect.objectContaining({ p_shift_date: '2026-11-08', p_expected_start: '2026-11-08T14:00:00.000Z', p_late_minutes: 720 }));
});
test('Open fences a draft selected on a different business day before any command', async () => {
    const { client } = setup(); expect(await runOpenStaffShift({ supabase: client as never, staffId: 'staff', bizId: 'biz', branchId: 'branch', requestedDate: '2026-11-09' })).toMatchObject({ ok: false, status: 409 });
    expect(client.rpc).toHaveBeenCalledTimes(1); expect(client.from).not.toHaveBeenCalled();
});
test('Save does not guess default date: SQL resolves existing ID or business today atomically', async () => {
    const client = { rpc: jest.fn().mockResolvedValue({ data: { ok: true, shift_id: 'shift', revision: 8, items: [] }, error: null }) };
    expect(await runSaveStaffShiftItems({ supabase: client, staffId: 'staff', bizId: 'biz', actorId: 'actor', items: [], isOwnerMode: true, useServiceClient: false, expectedShiftId: 'shift', expectedRevision: 7 })).toMatchObject({ ok: true });
    expect(client.rpc).toHaveBeenCalledWith('save_staff_shift_command', expect.objectContaining({ p_shift_date: null, p_expected_shift_id: 'shift', p_expected_revision: 7 }));
});
test('malformed calendar is not acknowledged as a writable default day', async () => {
    const client = { rpc: jest.fn().mockResolvedValue({ data: { ...calendar, dayHours: 25 }, error: null }) };
    await expect(readFinanceCalendar(client as never, 'biz','staff')).rejects.toThrow('Invalid business calendar');
});
