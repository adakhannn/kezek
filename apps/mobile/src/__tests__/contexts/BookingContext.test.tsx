import React from 'react';
import { act, renderHook } from '@testing-library/react-native';

import { BookingProvider, useBooking } from '../../contexts/BookingContext';

// jest.setup.js replaces the provider with a fixed draft for the screen tests.
jest.unmock('../../contexts/BookingContext');

describe('BookingProvider owner (R25-05)', () => {
    function renderBooking(initialOwnerId: string | null) {
        let ownerId = initialOwnerId;
        const rendered = renderHook(() => useBooking(), {
            wrapper: ({ children }: { children: React.ReactNode }) => (
                <BookingProvider ownerId={ownerId}>{children}</BookingProvider>
            ),
        });
        const switchOwner = (next: string | null) => {
            ownerId = next;
            rendered.rerender({});
        };
        return { result: rendered.result, switchOwner };
    }

    test('the draft is dropped when another account takes the device', () => {
        const { result, switchOwner } = renderBooking('user-1');
        act(() => {
            result.current.setBranchId('branch-1');
            result.current.setSelectedDate('2026-11-25');
        });
        expect(result.current.bookingData.branchId).toBe('branch-1');

        switchOwner('user-2');

        expect(result.current.bookingData.branchId).toBe('');
        expect(result.current.bookingData.selectedDate).toBe('');
    });

    test('the draft is dropped when the session ends, and kept while the same account stays', () => {
        const { result, switchOwner } = renderBooking('user-1');
        act(() => result.current.setBranchId('branch-1'));

        switchOwner('user-1');
        expect(result.current.bookingData.branchId).toBe('branch-1');

        switchOwner(null);
        expect(result.current.bookingData.branchId).toBe('');
    });

    test('a guest draft is kept when that guest signs in from the confirm step (C1)', () => {
        const { result, switchOwner } = renderBooking(null);
        act(() => {
            result.current.setBranchId('branch-1');
            result.current.setSelectedDate('2026-11-25');
        });

        switchOwner('user-1');

        expect(result.current.bookingData.branchId).toBe('branch-1');
        expect(result.current.bookingData.selectedDate).toBe('2026-11-25');
    });
});

describe('several services (C3)', () => {
    test('services are toggled in the chosen order; serviceId is the first of them', () => {
        const { result } = renderHook(() => useBooking(), {
            wrapper: ({ children }: { children: React.ReactNode }) => <BookingProvider>{children}</BookingProvider>,
        });
        act(() => result.current.setBranchId('branch-1'));
        act(() => result.current.toggleServiceId('color'));
        act(() => result.current.toggleServiceId('cut'));
        expect(result.current.bookingData.serviceIds).toEqual(['color', 'cut']);
        expect(result.current.bookingData.serviceId).toBe('color');

        act(() => result.current.toggleServiceId('color'));
        expect(result.current.bookingData.serviceIds).toEqual(['cut']);
        expect(result.current.bookingData.serviceId).toBe('cut');

        act(() => result.current.setBranchId('branch-2'));
        expect(result.current.bookingData.serviceIds).toEqual([]);
    });
});
