/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';
import { useTemporaryTransfers } from '@/app/b/[slug]/hooks/useTemporaryTransfers';
import { loadWorkLocationSnapshot } from '@/lib/scheduling/locationsClient';

jest.mock('@/lib/scheduling/locationsClient', () => ({ loadWorkLocationSnapshot:jest.fn() }));
const load = jest.mocked(loadWorkLocationSnapshot);
const staff = [{id:'s1',branch_id:'b1'},{id:'s2',branch_id:'b2'}];
beforeEach(() => jest.clearAllMocks());

test('loads only the selected day, preserving home availability and transfer-only semantics', async () => {
    load.mockResolvedValue({complete:true,locations:[
        {staff_id:'s1',branch_id:'b1',date_on:'2026-10-19'},
        {staff_id:'s2',branch_id:'b1',date_on:'2026-10-19'},
    ]});
    const {result}=renderHook(() => useTemporaryTransfers({bizId:'biz',branchId:'b1',dayStr:'2026-10-19',staff}));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(load).toHaveBeenCalledWith('biz','2026-10-19','2026-10-19');
    expect(result.current.workingLocations).toHaveLength(2);
    expect(result.current.temporaryTransfers).toEqual([{staff_id:'s2',branch_id:'b1',date:'2026-10-19'}]);
});
test('legacy rows are not mistaken for a complete empty working-day projection', async () => {
    load.mockResolvedValue({complete:false,locations:[]});
    const {result}=renderHook(() => useTemporaryTransfers({bizId:'biz',branchId:'b1',dayStr:'2026-10-19',staff}));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.workingLocations).toBeUndefined();
    expect(result.current.error).toBeNull();
});
test('failure is visible instead of a successful empty/off-day result', async () => {
    load.mockRejectedValue(new Error('Unavailable'));
    const {result}=renderHook(() => useTemporaryTransfers({bizId:'biz',branchId:'b1',dayStr:'2026-10-19',staff}));
    await waitFor(() => expect(result.current.error).toBe('Unavailable'));
    expect(result.current.workingLocations).toBeUndefined();
});
test('neither stale completed data nor a late response crosses date boundaries', async () => {
    let resolveOld!: (value: Awaited<ReturnType<typeof loadWorkLocationSnapshot>>) => void;
    let resolveNew!: typeof resolveOld;
    load.mockImplementationOnce(() => new Promise(resolve => {resolveOld=resolve;}))
        .mockImplementationOnce(() => new Promise(resolve => {resolveNew=resolve;}));
    const {result,rerender}=renderHook(({dayStr}) => useTemporaryTransfers({bizId:'biz',branchId:'b1',dayStr,staff}),
        {initialProps:{dayStr:'2026-10-19'}});
    rerender({dayStr:'2026-10-20'});
    expect(result.current.loading).toBe(true);
    await act(async () => resolveNew({complete:true,locations:[]}));
    await act(async () => resolveOld({complete:true,locations:[{staff_id:'s1',branch_id:'b1',date_on:'2026-10-19'}]}));
    expect(result.current.workingLocations).toEqual([]);
    rerender({dayStr:'2026-10-21'});
    expect(result.current.loading).toBe(true);
    expect(result.current.workingLocations).toBeUndefined();
});
