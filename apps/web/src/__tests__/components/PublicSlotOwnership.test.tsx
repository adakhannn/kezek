/** @jest-environment jsdom */
import { act, cleanup, renderHook } from '@testing-library/react';
import { useSlotsLoader } from '@/app/b/[slug]/hooks/useSlotsLoader';
import { useBookingSlotsState } from '@/app/b/[slug]/hooks/useBookingSlotsState';
import { supabase } from '@/lib/supabaseClient';

jest.mock('@/lib/supabaseClient', () => ({ supabase: { rpc: jest.fn(), from: jest.fn() } }));
jest.mock('@/lib/performance', () => ({ measurePerformance: (_name: string, run: () => Promise<unknown>) => run() }));
jest.mock('@/lib/log', () => ({ logDebug: jest.fn(), logWarn: jest.fn() }));
const rpc = supabase.rpc as jest.Mock;
const from = supabase.from as jest.Mock;
type Params = Parameters<typeof useSlotsLoader>[0];
type Slot = ReturnType<typeof useSlotsLoader>['slots'][number];
type Reply = { data: Slot[]; error: null };
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const base: Params = {
    bizId: 'biz-a', branchId: 'branch-a', staffId: 'staff-a', dayStr: '2030-01-05', serviceIds: ['service-a'],
    servicesFiltered: [{ id: 'service-a', duration_min: 60 }], serviceStaff: [{ service_id: 'service-a', staff_id: 'staff-a' }],
    temporaryTransfers: [], staff: [{ id: 'staff-a', branch_id: 'branch-a' }], t: (_key, fallback) => fallback ?? _key,
};
const slot = (time = '2030-01-05T10:00:00Z', overrides: Partial<Slot> = {}): Slot => ({ staff_id: 'staff-a', branch_id: 'branch-a', start_at: time, end_at: new Date(new Date(time).getTime() + 60 * 60_000).toISOString(), ...overrides });
const tick = async (ms = 300) => { await act(async () => { await jest.advanceTimersByTimeAsync(ms); }); };
beforeEach(() => { jest.useFakeTimers().setSystemTime(new Date('2030-01-05T00:00:00Z')); jest.clearAllMocks(); });
afterEach(() => { cleanup(); jest.useRealTimers(); });

test('empty input cancels the debounce and immediately exposes neither stale slots nor loading', async () => {
    rpc.mockResolvedValue({ data: [slot()], error: null });
    const { result, rerender } = renderHook(props => useSlotsLoader(props), { initialProps: base });
    expect(result.current.loading).toBe(true);
    rerender({ ...base, serviceIds: [] });
    expect(result.current).toMatchObject({ slots: [], loading: false, error: null });
    await tick();
    expect(rpc).not.toHaveBeenCalled();
});

test('single-service requests scope SQL to selected staff; any uses bounded page RPC', async () => {
    rpc.mockResolvedValueOnce({ data: [slot()], error: null }).mockResolvedValueOnce({ data: { slots: [slot()], next_cursor: null }, error: null });
    const { result, rerender } = renderHook(props => useSlotsLoader(props), { initialProps: base });
    await tick();
    expect(rpc).toHaveBeenLastCalledWith('get_free_slots_service_day_v2', expect.objectContaining({ p_staff_id: 'staff-a' }));
    rerender({ ...base, staffId: 'any' });
    expect(result.current.slots).toEqual([]);
    await tick();
    expect(rpc).toHaveBeenLastCalledWith('get_free_slots_page_v1', expect.objectContaining({ p_staff_id: null, p_cursor: null, p_limit: 100 }));
    expect(rpc).toHaveBeenCalledTimes(2);
});

test('a response from the previous business cannot replace the new result', async () => {
    const first = deferred<Reply>(), second = deferred<Reply>();
    rpc.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(props => useSlotsLoader(props), { initialProps: base });
    await tick();
    rerender({ ...base, bizId: 'biz-b' });
    expect(result.current).toMatchObject({ slots: [], loading: true });
    await tick();
    const current = slot('2030-01-05T12:00:00Z');
    await act(async () => { second.resolve({ data: [current], error: null }); });
    expect(result.current.slots).toEqual([current]);
    await act(async () => { first.resolve({ data: [slot()], error: null }); });
    expect(result.current.slots).toEqual([current]);
    expect(rpc.mock.calls.map(([, args]) => args.p_biz_id)).toEqual(['biz-a', 'biz-b']);
});

test('returning A→B→A after TTL cannot resurrect the old snapshot or use an expired cache', async () => {
    const pendingB = deferred<Reply>(), freshA = deferred<Reply>();
    rpc.mockResolvedValueOnce({ data: [slot()], error: null }).mockReturnValueOnce(pendingB.promise).mockReturnValueOnce(freshA.promise);
    const { result, rerender } = renderHook(props => useSlotsLoader(props), { initialProps: base });
    await tick();
    expect(result.current.slots).toHaveLength(1);
    rerender({ ...base, bizId: 'biz-b' }); await tick(); await tick(10_001);
    rerender(base);
    expect(result.current).toMatchObject({ slots: [], loading: true });
    await tick(); expect(rpc).toHaveBeenCalledTimes(3);
    const newer = slot('2030-01-05T13:00:00Z');
    await act(async () => { freshA.resolve({ data: [newer], error: null }); pendingB.resolve({ data: [slot()], error: null }); });
    expect(result.current.slots).toEqual([newer]);
});

test('a valid cache hit still reapplies the 30-minute cutoff on A→B→A', async () => {
    const pendingB = deferred<Reply>();
    rpc.mockResolvedValueOnce({ data: [slot('2030-01-05T00:30:05Z')], error: null }).mockReturnValueOnce(pendingB.promise);
    const { result, rerender } = renderHook(props => useSlotsLoader(props), { initialProps: base });
    await tick(); expect(result.current.slots).toHaveLength(1);
    rerender({ ...base, branchId: 'branch-b' }); await tick(); await tick(8_000);
    rerender(base);
    expect(result.current).toMatchObject({ slots: [], loading: true });
    await act(async () => {});
    expect(result.current).toMatchObject({ slots: [], loading: false });
    expect(rpc).toHaveBeenCalledTimes(2);
});

test('cache ownership includes branch and complex duration; equivalent props do not start requests', async () => {
    rpc.mockResolvedValue({ data: [slot()], error: null });
    const complex = { ...base, serviceIds: ['service-a', 'service-b'], servicesFiltered: [{ id: 'service-a', duration_min: 60 }, { id: 'service-b', duration_min: 60 }] };
    const { rerender } = renderHook(props => useSlotsLoader(props), { initialProps: complex });
    await tick();
    rerender({ ...complex, serviceIds: [...complex.serviceIds], staff: [...complex.staff], t: (key, fallback) => fallback ?? key });
    await tick(); expect(rpc).toHaveBeenCalledTimes(1);
    rerender({ ...complex, branchId: 'branch-b' }); await tick();
    rerender({ ...complex, servicesFiltered: [{ id: 'service-a', duration_min: 60 }, { id: 'service-b', duration_min: 90 }] }); await tick();
    expect(rpc.mock.calls.map(([name, args]) => [name, args.p_duration_min])).toEqual([
        ['get_free_slots_complex_day_v1', 120], ['get_free_slots_complex_day_v1', 120], ['get_free_slots_complex_day_v1', 150],
    ]);
});

test('outer booking filter keeps slots hidden until its own response and ignores an old day filter', async () => {
    const filterA = deferred<{ data: []; error: null }>(), filterB = deferred<{ data: []; error: null }>();
    const replies = [filterA.promise, filterB.promise];
    from.mockImplementation(() => {
        const query: Record<string, jest.Mock> = {};
        for (const name of ['select', 'eq', 'not', 'gte']) query[name] = jest.fn(() => query);
        query.lte = jest.fn(() => replies.shift());
        return query;
    });
    const first = slot(), second = slot('2030-01-06T10:00:00Z');
    rpc.mockResolvedValueOnce({ data: [first], error: null }).mockResolvedValueOnce({ data: [second], error: null });
    const params: Parameters<typeof useBookingSlotsState>[0] = { ...base, serviceId: 'service-a',
        servicesFiltered: [{ id: 'service-a', name_ru: 'Synthetic', branch_id: 'branch-a', duration_min: 60 }],
        serviceStaff: [{ service_id: 'service-a', staff_id: 'staff-a', is_active: true }],
        staff: [{ id: 'staff-a', branch_id: 'branch-a', full_name: 'Synthetic', rating_score: null }], staffForSchedule: base.staff };
    const { result, rerender } = renderHook(props => useBookingSlotsState(props), { initialProps: params });
    await tick();
    expect(result.current).toMatchObject({ slots: [], slotsLoading: true });
    rerender({ ...params, dayStr: '2030-01-06' }); await tick();
    await act(async () => { filterB.resolve({ data: [], error: null }); });
    expect(result.current.slots).toEqual([second]);
    await act(async () => { filterA.resolve({ data: [], error: null }); });
    expect(result.current.slots).toEqual([second]);
    rerender({ ...params, serviceIds: [], serviceId: '' });
    expect(result.current).toMatchObject({ slots: [], slotsLoading: false });
});
const nextCursor = { v: 1, scope: 'scope-a', staff_id: 'staff-a', start_at: null };
test('any-staff empty intermediate page preserves continuation and loads only on demand', async () => {
    rpc.mockResolvedValueOnce({ data: { slots: [], next_cursor: nextCursor }, error: null })
        .mockResolvedValueOnce({ data: { slots: [slot(), slot(undefined, { staff_id: 'staff-b' })], next_cursor: null }, error: null });
    const { result } = renderHook(() => useSlotsLoader({ ...base, staffId: 'any' }));
    await tick();
    expect(result.current).toMatchObject({ slots: [], loading: false, hasMore: true, error: null });
    await tick(1000); expect(rpc).toHaveBeenCalledTimes(1);
    await act(async () => { result.current.loadMore(); result.current.loadMore(); });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenLastCalledWith('get_free_slots_page_v1', expect.objectContaining({ p_cursor: nextCursor }));
    expect(result.current.slots.map(value => value.staff_id)).toEqual(['staff-a', 'staff-b']);
    expect(result.current.hasMore).toBe(false);
});

test('complex any-staff pagination uses the same bounded RPC and full duration', async () => {
    rpc.mockResolvedValue({ data: { slots: [], next_cursor: null }, error: null });
    renderHook(() => useSlotsLoader({ ...base, staffId: 'any', serviceIds: ['service-a', 'service-b'],
        servicesFiltered: [{ id: 'service-a', duration_min: 30 }, { id: 'service-b', duration_min: 60 }] }));
    await tick();
    expect(rpc).toHaveBeenCalledWith('get_free_slots_page_v1', expect.objectContaining({
        p_service_id: null, p_duration_min: 90, p_branch_id: 'branch-a', p_limit: 100,
    }));
});

test('late next-page response cannot append slots or cursor after a filter change', async () => {
    const pending = deferred<{ data: { slots: Slot[]; next_cursor: null }; error: null }>();
    rpc.mockResolvedValueOnce({ data: { slots: [slot()], next_cursor: nextCursor }, error: null })
        .mockReturnValueOnce(pending.promise)
        .mockResolvedValueOnce({ data: { slots: [slot('2030-01-05T15:00:00Z')], next_cursor: null }, error: null });
    const { result, rerender } = renderHook(props => useSlotsLoader(props), { initialProps: { ...base, staffId: 'any' } });
    await tick();
    await act(async () => result.current.loadMore());
    expect(result.current.loadingMore).toBe(true);
    rerender({ ...base, staffId: 'any', bizId: 'biz-b' });
    expect(result.current.slots).toEqual([]);
    await tick();
    const fresh = result.current.slots;
    await act(async () => pending.resolve({ data: { slots: [slot('2030-01-05T16:00:00Z')], next_cursor: null }, error: null }));
    expect(result.current.slots).toBe(fresh);
    expect(result.current).toMatchObject({ hasMore: false, loadingMore: false });
});

test('next-page failure retains visible slots and cursor for an explicit retry', async () => {
    rpc.mockResolvedValueOnce({ data: { slots: [slot()], next_cursor: nextCursor }, error: null })
        .mockRejectedValueOnce(new Error('synthetic network failure'))
        .mockResolvedValueOnce({ data: { slots: [slot(undefined, { staff_id: 'staff-b' })], next_cursor: null }, error: null });
    const { result } = renderHook(() => useSlotsLoader({ ...base, staffId: 'any' }));
    await tick();
    await act(async () => result.current.loadMore());
    expect(result.current.slots).toEqual([slot()]);
    expect(result.current).toMatchObject({ hasMore: true, loadingMore: false, error: null });
    expect(result.current.moreError).toEqual(expect.any(String));
    await act(async () => result.current.loadMore());
    expect(result.current.slots).toHaveLength(2);
    expect(rpc.mock.calls[1][1].p_cursor).toEqual(rpc.mock.calls[2][1].p_cursor);
});

test('malformed page data fails visibly instead of masquerading as final availability', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const { result } = renderHook(() => useSlotsLoader({ ...base, staffId: 'any' }));
    await tick();
    expect(result.current.error).toEqual(expect.any(String));
    expect(result.current).toMatchObject({ slots: [], loading: false, hasMore: false });
});
