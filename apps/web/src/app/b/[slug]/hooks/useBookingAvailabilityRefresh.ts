import { useCallback } from 'react';

type Params = {
    isAuthed: boolean;
    refreshSlots: () => void;
    refetchClientBookings: () => Promise<unknown>;
};

/** A changed slot also invalidates the client's existing-visit warning. */
export function useBookingAvailabilityRefresh({ isAuthed, refreshSlots, refetchClientBookings }: Params) {
    return useCallback(() => {
        refreshSlots();
        if (isAuthed) void refetchClientBookings();
    }, [isAuthed, refreshSlots, refetchClientBookings]);
}
