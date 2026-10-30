/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import { useBookingAvailabilityRefresh } from '@/app/b/[slug]/hooks/useBookingAvailabilityRefresh';

test('refreshes both availability and the existing-visit warning for authenticated clients', () => {
    const refreshSlots = jest.fn();
    const refetchClientBookings = jest.fn().mockResolvedValue({ data:4 });
    const { result } = renderHook(() => useBookingAvailabilityRefresh({ isAuthed:true, refreshSlots, refetchClientBookings }));
    act(() => result.current());
    expect(refreshSlots).toHaveBeenCalledTimes(1);
    expect(refetchClientBookings).toHaveBeenCalledTimes(1);
});

test('does not force the disabled own-bookings query for a guest', () => {
    const refreshSlots = jest.fn();
    const refetchClientBookings = jest.fn().mockResolvedValue({ data:0 });
    const { result, rerender } = renderHook(({ isAuthed }) => useBookingAvailabilityRefresh({ isAuthed, refreshSlots, refetchClientBookings }), { initialProps:{ isAuthed:false } });
    act(() => result.current());
    expect(refreshSlots).toHaveBeenCalledTimes(1);
    expect(refetchClientBookings).not.toHaveBeenCalled();
    rerender({ isAuthed:true });
    act(() => result.current());
    expect(refreshSlots).toHaveBeenCalledTimes(2);
    expect(refetchClientBookings).toHaveBeenCalledTimes(1);
});
