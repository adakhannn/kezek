import { isShiftDurationWithinDay } from '@core-domain/finance/guarantee';
import { readShiftCloseSnapshot, shiftCloseTime, validateCloseSnapshot } from '@/lib/staffShift/closeSnapshot';
const snapshot = { shift: { id: 'shift', staff_id: 'staff', biz_id: 'biz', shift_date: '2026-11-01', status: 'open' as const, opened_at: '2026-11-01T04:00Z', ledger_revision: 9 },
    staff: { percent_master: 60, percent_salon: 40, hourly_rate: 100 }, timezone: 'America/New_York', dayStart: '2026-11-01T04:00Z', closeBoundary: '2026-11-02T05:00Z', dayHours: 25, items: [] };
test('close snapshot uses an explicit scoped scalar RPC and retains more than 1000 items', async () => {
    const items = Array.from({ length: 1501 }, (_, i) => ({ id: 'item-' + i, service_amount: 1.25, consumables_amount: 0.5, booking_id: null }));
    const rpc = jest.fn(async () => ({ data: { ...snapshot, items }, error: null }));
    const result = await readShiftCloseSnapshot({ rpc }, 'biz', 'staff', 'shift');
    expect(result.items).toHaveLength(1501); expect(result.items.reduce((sum, item) => sum + Number(item.service_amount), 0)).toBe(1876.25);
    expect(rpc).toHaveBeenCalledWith('read_staff_shift_close_snapshot', { p_biz_id: 'biz', p_staff_id: 'staff', p_shift_id: 'shift' });
});
test.each([null, { ...snapshot, items: null }, { ...snapshot, dayHours: NaN }, { ...snapshot, closeBoundary: 'bad' }])('rejects incomplete snapshot %p', data => expect(() => validateCloseSnapshot(data)).toThrow());
test('foreign scope and dependency failure never produce a usable ledger', async () => {
    await expect(readShiftCloseSnapshot({ rpc: async () => ({ data: snapshot, error: null }) }, 'foreign', 'staff', 'shift')).rejects.toThrow('scope');
    await expect(readShiftCloseSnapshot({ rpc: async () => ({ data: snapshot, error: { message: 'offline' } }) }, 'biz', 'staff', 'shift')).rejects.toThrow('offline');
});
test('late historical close stops at local midnight while an intraday close retains its actual instant', () => {
    expect(shiftCloseTime(snapshot, new Date('2026-11-10T00:00Z')).toISOString()).toBe('2026-11-02T05:00:00.000Z');
    expect(shiftCloseTime(snapshot, new Date('2026-11-01T20:00Z')).toISOString()).toBe('2026-11-01T20:00:00.000Z');
});
test.each(['2026-11-01T03:00Z', '2026-11-03T00:00Z'])('opening outside the financial day requires review: %s', opened_at => {
    expect(() => shiftCloseTime({ ...snapshot, shift: { ...snapshot.shift, opened_at } }, new Date('2026-11-10T00:00Z'))).toThrow('needs_review');
});
test.each([[23, 23, true], [24, 24, true], [25, 25, true], [25, 24, false], [24, 23, false], [-1, 24, false], [NaN, 24, false], [null, 25, true]])('actual hours %s within local day %s => %s', (hours, dayHours, expected) => {
    expect(isShiftDurationWithinDay(hours as number | null, dayHours as number)).toBe(expected);
});
