/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import { useTemporaryTransfers } from '@/app/dashboard/bookings/components/useTemporaryTransfers';
import { loadWorkLocations, type WorkLocation } from '@/lib/scheduling/locationsClient';
import { logError } from '@/lib/log';

jest.mock('@/lib/scheduling/locationsClient', () => ({ loadWorkLocations: jest.fn() }));
jest.mock('@/lib/log', () => ({ logError: jest.fn() }));

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
    return { promise, resolve, reject };
}
type Params = { bizId: string; date: string; staff: Array<{ id: string; branch_id: string }> };
const base: Params = { bizId: 'biz-a', date: '2030-01-10', staff: [{ id: 'staff-a', branch_id: 'home-a' }] };
const location = (params = base, branch = 'temporary-a'): WorkLocation => ({
    staff_id: params.staff[0].id, branch_id: branch, date_on: params.date,
});
const row = (params = base, branch = 'temporary-a') => ({ staff_id: params.staff[0].id, branch_id: branch, date: params.date });
const load = jest.mocked(loadWorkLocations);
function mount(initialProps: Params = base) {
    return renderHook(({ bizId, date, staff }) => useTemporaryTransfers(bizId, date, staff), { initialProps });
}
beforeEach(() => { load.mockReset(); jest.mocked(logError).mockClear(); });

it.each([
    ['business', { bizId: 'biz-b' }],
    ['date', { date: '2030-01-11' }],
    ['staff identity', { staff: [{ id: 'staff-b', branch_id: 'home-a' }] }],
    ['staff home branch', { staff: [{ id: 'staff-a', branch_id: 'home-b' }] }],
] satisfies Array<[string, Partial<Params>]>)('hides old transfer rows immediately when %s changes', async (_label, patch) => {
    const first = deferred<WorkLocation[]>();
    const next = deferred<WorkLocation[]>();
    load.mockReturnValueOnce(first.promise).mockReturnValueOnce(next.promise);
    const { result, rerender } = mount();
    await act(async () => first.resolve([location()]));
    expect(result.current).toEqual([row()]);
    const updated = { ...base, ...patch };
    rerender(updated);
    expect(result.current).toEqual([]);
    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenLastCalledWith(updated.bizId, updated.date, updated.date, true);
    await act(async () => next.resolve([location(updated, 'temporary-b')]));
    expect(result.current).toEqual([row(updated, 'temporary-b')]);
});

it.each(['resolve', 'reject'] as const)('ignores late %s from an obsolete request after the current one settles', async completion => {
    const first = deferred<WorkLocation[]>();
    const next = deferred<WorkLocation[]>();
    load.mockReturnValueOnce(first.promise).mockReturnValueOnce(next.promise);
    const { result, rerender } = mount();
    const updated = { ...base, date: '2030-01-11' };
    rerender(updated);
    await act(async () => next.resolve([location(updated, 'temporary-b')]));
    await act(async () => {
        if (completion === 'resolve') first.resolve([location()]);
        else first.reject(new Error('stale transfer failure'));
    });
    expect(result.current).toEqual([row(updated, 'temporary-b')]);
    expect(logError).not.toHaveBeenCalled();
});

it('does not resurrect the settled A snapshot during A to pending B to A', async () => {
    const firstA = deferred<WorkLocation[]>();
    const pendingB = deferred<WorkLocation[]>();
    const currentA = deferred<WorkLocation[]>();
    load.mockReturnValueOnce(firstA.promise).mockReturnValueOnce(pendingB.promise).mockReturnValueOnce(currentA.promise);
    const { result, rerender } = mount();
    await act(async () => firstA.resolve([location()]));
    expect(result.current).toEqual([row()]);
    const other = { ...base, bizId: 'biz-b' };
    rerender(other);
    rerender({ ...base });
    expect(result.current).toEqual([]);
    expect(load).toHaveBeenCalledTimes(3);
    await act(async () => pendingB.resolve([location(other, 'temporary-b')]));
    expect(result.current).toEqual([]);
    await act(async () => currentA.resolve([location(base, 'temporary-new-a')]));
    expect(result.current).toEqual([row(base, 'temporary-new-a')]);
});

it.each([{ bizId: '' }, { date: '' }, { staff: [] }] satisfies Array<Partial<Params>>)('returns no rows and does not fetch with disabled inputs %j', async patch => {
    const request = deferred<WorkLocation[]>();
    load.mockReturnValueOnce(request.promise);
    const { result, rerender } = mount();
    await act(async () => request.resolve([location()]));
    rerender({ ...base, ...patch });
    expect(result.current).toEqual([]);
    expect(load).toHaveBeenCalledTimes(1);
});

it('ignores the in-flight response after the staff list becomes empty', async () => {
    const request = deferred<WorkLocation[]>();
    load.mockReturnValueOnce(request.promise);
    const { result, rerender } = mount();
    rerender({ ...base, staff: [] });
    await act(async () => request.resolve([location()]));
    expect(result.current).toEqual([]);
    expect(load).toHaveBeenCalledTimes(1);
});

it('retains the current result without fetching for an equivalent reordered staff array', async () => {
    const initial = { ...base, staff: [...base.staff, { id: 'staff-b', branch_id: 'home-b' }] };
    const request = deferred<WorkLocation[]>();
    load.mockReturnValueOnce(request.promise);
    const { result, rerender } = mount(initial);
    await act(async () => request.resolve([location(initial)]));
    const current = result.current;
    rerender({ ...initial, staff: initial.staff.map(member => ({ ...member })).reverse() });
    expect(load).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(current);
    expect(result.current).toEqual([row(initial)]);
});

it('only exposes transfers for current staff that differ from their home branch', async () => {
    const request = deferred<WorkLocation[]>();
    load.mockReturnValueOnce(request.promise);
    const { result } = mount();
    await act(async () => request.resolve([
        location(), location(base, 'home-a'), { staff_id: 'outside-staff', branch_id: 'temporary-a', date_on: base.date },
    ]));
    expect(result.current).toEqual([row()]);
});
