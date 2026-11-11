import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { supabase } from '../../lib/supabase';
import { useBookingStep5Slots } from '../../screens/booking/useBookingStep5Slots';
import { createTestQueryClient } from '../testQueryClient';

jest.mock('../../hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOffline: false }) }));
const rpc = supabase.rpc as jest.Mock;
const data = { business: { id: 'business' }, serviceId: 'service', selectedDate: '2035-01-01', staffId: 'staff-a', branchId: 'branch' };
const slot = (staffId: string) => ({ staff_id: staffId, branch_id: 'branch', start_at: '2035-01-01T10:00:00Z', end_at: '2035-01-01T10:30:00Z' });
function setup() {
    const client = createTestQueryClient();
    return ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => rpc.mockReset());

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
