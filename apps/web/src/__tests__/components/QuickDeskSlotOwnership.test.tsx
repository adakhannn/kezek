/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import { useQuickDeskSlots, type UseQuickDeskSlotsParams } from '@/app/dashboard/bookings/components/useQuickDeskSlots';
import { getFreeSlotsForServiceDay, type DashboardSlot } from '@/lib/bookingDashboardService';
import { logError } from '@/lib/log';

jest.mock('@/lib/bookingDashboardService', () => ({ getFreeSlotsForServiceDay: jest.fn() }));
jest.mock('@/lib/log', () => ({ logDebug: jest.fn(), logError: jest.fn() }));

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
    return { promise, resolve, reject };
}
const base: UseQuickDeskSlotsParams = {
    bizId: 'biz-a', branchId: 'branch-a', staffId: 'staff-a', serviceId: 'service-a', date: '2030-01-10',
    scheduleContext: { targetBranchId: 'branch-a', isTemporaryTransfer: false, homeBranchId: 'branch-a' },
};
function slot(params = base, hour = '12'): DashboardSlot {
    return {
        staff_id: params.staffId || 'staff-a',
        branch_id: params.scheduleContext?.isTemporaryTransfer ? params.scheduleContext.targetBranchId : params.branchId,
        start_at: `${params.date}T${hour}:00:00.000Z`, end_at: `${params.date}T${hour}:30:00.000Z`,
    };
}
const fetchSlots = jest.mocked(getFreeSlotsForServiceDay);
function mount(initialProps: UseQuickDeskSlotsParams = base) {
    return renderHook(params => useQuickDeskSlots(params), { initialProps });
}
beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-10T00:00:00Z'));
    fetchSlots.mockReset();
    jest.mocked(logError).mockClear();
});
afterEach(() => jest.useRealTimers());

it.each([
    ['business', { bizId: 'biz-b' }],
    ['date', { date: '2030-01-11' }],
    ['staff', { staffId: 'staff-b' }],
    ['branch', { branchId: 'branch-b' }],
    ['service', { serviceId: 'service-b' }],
    ['transfer destination', { scheduleContext: { targetBranchId: 'branch-b', isTemporaryTransfer: true } }],
] satisfies Array<[string, Partial<UseQuickDeskSlotsParams>]>)('hides the previous slots and selection immediately when %s changes', async (_label, patch) => {
    const first = deferred<DashboardSlot[]>();
    const next = deferred<DashboardSlot[]>();
    fetchSlots.mockReturnValueOnce(first.promise).mockReturnValueOnce(next.promise);
    const { result, rerender } = mount();
    await act(async () => first.resolve([slot()]));
    expect(result.current.slots).toEqual([slot()]);
    expect(result.current.slotStartISO).toBe(slot().start_at);
    const updated = { ...base, ...patch };
    rerender(updated);
    expect(result.current.slots).toEqual([]);
    expect(result.current.slotStartISO).toBe('');
    expect(result.current.slotsLoading).toBe(true);
    expect(fetchSlots).toHaveBeenCalledTimes(2);
    expect(fetchSlots).toHaveBeenLastCalledWith({ bizId: updated.bizId, serviceId: updated.serviceId, staffId: updated.staffId, day: updated.date, perStaff: 400, stepMinutes: 15 });
    await act(async () => next.resolve([slot(updated)]));
    expect(result.current.slots).toEqual([slot(updated)]);
    expect(result.current.slotsLoading).toBe(false);
});

it.each(['resolve', 'reject'] as const)('ignores a late %s from the previous request after the current request succeeds', async completion => {
    const old = deferred<DashboardSlot[]>();
    const current = deferred<DashboardSlot[]>();
    fetchSlots.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const { result, rerender } = mount();
    const updated = { ...base, date: '2030-01-11' };
    rerender(updated);
    await act(async () => current.resolve([slot(updated)]));
    await act(async () => {
        if (completion === 'resolve') old.resolve([slot()]);
        else old.reject(new Error('stale request failure'));
    });
    expect(result.current.slots).toEqual([slot(updated)]);
    expect(result.current.slotStartISO).toBe(slot(updated).start_at);
    expect(result.current.slotsLoading).toBe(false);
    expect(logError).not.toHaveBeenCalled();
});

it('does not resurrect a settled A snapshot during A to B to A before the new A request settles', async () => {
    const firstA = deferred<DashboardSlot[]>();
    const pendingB = deferred<DashboardSlot[]>();
    const currentA = deferred<DashboardSlot[]>();
    fetchSlots.mockReturnValueOnce(firstA.promise).mockReturnValueOnce(pendingB.promise).mockReturnValueOnce(currentA.promise);
    const { result, rerender } = mount();
    await act(async () => firstA.resolve([slot()]));
    rerender({ ...base, date: '2030-01-11' });
    rerender({ ...base });
    expect(result.current.slots).toEqual([]);
    expect(result.current.slotStartISO).toBe('');
    expect(result.current.slotsLoading).toBe(true);
    expect(fetchSlots).toHaveBeenCalledTimes(3);
    await act(async () => pendingB.resolve([slot({ ...base, date: '2030-01-11' })]));
    expect(result.current.slots).toEqual([]);
    expect(result.current.slotsLoading).toBe(true);
    await act(async () => currentA.resolve([slot(base, '15')]));
    expect(result.current.slots).toEqual([slot(base, '15')]);
    expect(result.current.slotStartISO).toBe(slot(base, '15').start_at);
});

it.each([
    { bizId: '' }, { branchId: '' }, { staffId: '' }, { staffId: 'any' }, { serviceId: '' }, { date: '' }, { scheduleContext: null },
] satisfies Array<Partial<UseQuickDeskSlotsParams>>)('clears visible data and loading without another request for disabled inputs %j', async patch => {
    const request = deferred<DashboardSlot[]>();
    fetchSlots.mockReturnValueOnce(request.promise);
    const { result, rerender } = mount();
    await act(async () => request.resolve([slot()]));
    rerender({ ...base, ...patch });
    expect(result.current.slots).toEqual([]);
    expect(result.current.slotStartISO).toBe('');
    expect(result.current.slotsLoading).toBe(false);
    expect(fetchSlots).toHaveBeenCalledTimes(1);
});

it('does not fetch again for an equivalent schedule context object', async () => {
    const request = deferred<DashboardSlot[]>();
    fetchSlots.mockReturnValueOnce(request.promise);
    const { result, rerender } = mount();
    await act(async () => request.resolve([slot()]));
    const current = result.current.slots;
    rerender({ ...base, scheduleContext: { ...base.scheduleContext! } });
    expect(fetchSlots).toHaveBeenCalledTimes(1);
    expect(result.current.slots).toBe(current);
    expect(result.current.slotsLoading).toBe(false);
});

it('keeps clearSlots stable across scope changes and invalidates every older in-flight result', async () => {
    const first = deferred<DashboardSlot[]>();
    const second = deferred<DashboardSlot[]>();
    fetchSlots.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result, rerender } = mount();
    const clear = result.current.clearSlots;
    const setter = result.current.setSlotStartISO;
    const updated = { ...base, date: '2030-01-11' };
    rerender(updated);
    expect(result.current.clearSlots).toBe(clear);
    expect(result.current.setSlotStartISO).toBe(setter);
    act(() => clear());
    expect(result.current.slotsLoading).toBe(false);
    await act(async () => { first.resolve([slot()]); second.resolve([slot(updated)]); });
    expect(result.current.slots).toEqual([]);
    expect(result.current.slotStartISO).toBe('');
    expect(result.current.slotsLoading).toBe(false);
    expect(fetchSlots).toHaveBeenCalledTimes(2);
});

it('supports both direct selection and functional selection updates', async () => {
    const request = deferred<DashboardSlot[]>();
    fetchSlots.mockReturnValueOnce(request.promise);
    const { result } = mount();
    const first = slot();
    const second = slot(base, '13');
    await act(async () => request.resolve([first, second]));
    act(() => result.current.setSlotStartISO(second.start_at));
    expect(result.current.slotStartISO).toBe(second.start_at);
    const update = jest.fn((previous: string) => previous === second.start_at ? first.start_at : 'unexpected');
    act(() => result.current.setSlotStartISO(update));
    expect(update).toHaveBeenCalledWith(second.start_at);
    expect(result.current.slotStartISO).toBe(first.start_at);
    expect(result.current.slots).toEqual([first, second]);
    expect(fetchSlots).toHaveBeenCalledTimes(1);
});
