import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { apiRequest } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { useBookingStep5Slots } from '../../screens/booking/useBookingStep5Slots';
import { createTestQueryClient } from '../testQueryClient';

jest.mock('../../hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOffline: false }) }));
jest.mock('../../lib/api', () => ({ apiRequest: jest.fn() }));
const mockApiRequest = jest.mocked(apiRequest);
const rpc = supabase.rpc as jest.Mock;
const data = { business: { id: 'business' }, serviceId: 'service', selectedDate: '2035-01-01', staffId: 'staff-a', branchId: 'branch' };
const slot = (staffId: string) => ({ staff_id: staffId, branch_id: 'branch', start_at: '2035-01-01T10:00:00Z', end_at: '2035-01-01T10:30:00Z' });
function setup() {
    const client = createTestQueryClient();
    return ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => {
    rpc.mockReset();
    mockApiRequest.mockReset();
    mockApiRequest.mockResolvedValue({ ok: true, data: [] });
});

test('requests selected staff from SQL and retains defensive branch/time filtering', async () => {
    rpc.mockResolvedValue({ data: [slot('staff-a'), slot('staff-b'), { ...slot('staff-a'), branch_id: 'other' }], error: null });
    const hook = renderHook(() => useBookingStep5Slots(data), { wrapper: setup() });
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    expect(rpc).toHaveBeenCalledWith('get_free_slots_service_day_v2', {
        p_biz_id: 'business', p_service_id: 'service', p_staff_id: 'staff-a', p_day: '2035-01-01', p_per_staff: 400, p_step_min: 15,
    });
    expect(hook.result.current.slots).toEqual([slot('staff-a')]);
});

test('a late response for the old staff cannot appear under the new selection', async () => {
    let finish!: (value: unknown) => void;
    rpc.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    rpc.mockResolvedValueOnce({ data: [slot('staff-b')], error: null });
    const hook = renderHook(props => useBookingStep5Slots(props), { initialProps: data, wrapper: setup() });
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    hook.rerender({ ...data, staffId: 'staff-b' });
    await waitFor(() => expect(hook.result.current.slots).toEqual([slot('staff-b')]));
    await act(async () => { finish({ data: [slot('staff-a')], error: null }); });
    expect(hook.result.current.slots).toEqual([slot('staff-b')]);
    expect(rpc.mock.calls.map(([, args]) => args.p_staff_id)).toEqual(['staff-a', 'staff-b']);
});

test('no staff selected means no availability request', () => {
    const hook = renderHook(() => useBookingStep5Slots({ ...data, staffId: null }), { wrapper: setup() });
    expect(hook.result.current.slots).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
});

describe('parity with the website slots (C3, C4, C5)', () => {
    const services = [{ id: 'cut', duration_min: 30 }, { id: 'color', duration_min: 60 }];
    const cursor = { v: 1, scope: 'scope', staff_id: '00000000-0000-4000-8000-000000000001', start_at: '2035-01-01T10:00:00Z' };

    test('several services of a master use the complex day slots with the total duration', async () => {
        rpc.mockResolvedValue({ data: [slot('staff-a')], error: null });
        const hook = renderHook(() => useBookingStep5Slots({ ...data, serviceIds: ['cut', 'color'], services }), { wrapper: setup() });
        await waitFor(() => expect(hook.result.current.slots).toEqual([slot('staff-a')]));
        expect(rpc).toHaveBeenCalledWith('get_free_slots_complex_day_v1', {
            p_biz_id: 'business', p_branch_id: null, p_staff_id: 'staff-a', p_day: '2035-01-01',
            p_duration_min: 90, p_step_min: 15, p_per_staff: 400,
        });
    });

    test('"any master" pages through every master; several services pass p_service_ids', async () => {
        rpc.mockResolvedValueOnce({ data: { slots: [slot('staff-a'), { ...slot('staff-c'), branch_id: 'other' }], next_cursor: cursor }, error: null });
        rpc.mockResolvedValueOnce({ data: { slots: [slot('staff-b')], next_cursor: null }, error: null });
        const hook = renderHook(
            () => useBookingStep5Slots({ ...data, staffId: 'any', serviceIds: ['cut', 'color'], services }),
            { wrapper: setup() },
        );
        await waitFor(() => expect(hook.result.current.slots).toEqual([slot('staff-a')]));
        expect(rpc).toHaveBeenLastCalledWith('get_free_slots_page_v1', {
            p_biz_id: 'business', p_branch_id: 'branch', p_day: '2035-01-01', p_service_id: null,
            p_duration_min: 90, p_staff_id: null, p_cursor: null, p_limit: 100, p_service_ids: ['color', 'cut'],
        });
        expect(hook.result.current.hasMore).toBe(true);

        act(() => hook.result.current.loadMore());
        await waitFor(() => expect(hook.result.current.slots).toEqual([slot('staff-a'), slot('staff-b')]));
        expect(rpc.mock.calls[1][1].p_cursor).toEqual(cursor);
        expect(hook.result.current.hasMore).toBe(false);
    });

    test('"any master" with one service sends p_service_id', async () => {
        rpc.mockResolvedValue({ data: { slots: [], next_cursor: null }, error: null });
        const hook = renderHook(() => useBookingStep5Slots({ ...data, staffId: 'any' }), { wrapper: setup() });
        await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
        expect(rpc.mock.calls[0][1]).toMatchObject({ p_service_id: 'service', p_duration_min: null, p_service_ids: null });
    });

    test('a master working at another branch that day has no slots here and says so', async () => {
        mockApiRequest.mockResolvedValue({ ok: true, data: [{ staff_id: 'staff-a', branch_id: 'other', date_on: '2035-01-01' }] });
        rpc.mockResolvedValue({ data: [{ ...slot('staff-a'), branch_id: 'other' }], error: null });
        const hook = renderHook(
            () => useBookingStep5Slots({ ...data, staff: [{ id: 'staff-a', branch_id: 'branch' }] }),
            { wrapper: setup() },
        );
        await waitFor(() => expect(hook.result.current.worksElsewhere).toBe(true));
        expect(hook.result.current.slots).toEqual([]);
    });

    test('a master visiting this branch that day gets its slots here', async () => {
        mockApiRequest.mockResolvedValue({ ok: true, data: [{ staff_id: 'staff-a', branch_id: 'branch', date_on: '2035-01-01' }] });
        rpc.mockResolvedValue({ data: [slot('staff-a')], error: null });
        const hook = renderHook(
            () => useBookingStep5Slots({ ...data, staff: [{ id: 'staff-a', branch_id: 'home' }] }),
            { wrapper: setup() },
        );
        await waitFor(() => expect(hook.result.current.slots).toEqual([slot('staff-a')]));
        expect(hook.result.current.worksElsewhere).toBe(false);
    });
});
