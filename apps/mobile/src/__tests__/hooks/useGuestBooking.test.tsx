import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';

import { useGuestBooking, type GuestBookingParams } from '../../hooks/useGuestBooking';
import { apiRequest } from '../../lib/api';
import { createTestQueryClient } from '../testQueryClient';

jest.mock('../../lib/api', () => ({ apiRequest: jest.fn() }));

const mockApiRequest = jest.mocked(apiRequest);

const params: GuestBookingParams = {
    biz_id: 'biz-1',
    branch_id: 'branch-1',
    staff_id: 'staff-1',
    start_at: '2035-06-02T13:00:00+06:00',
    services: [
        { service_id: 'cut', duration_min: 30, order_index: 0 },
        { service_id: 'color', duration_min: 60, order_index: 1 },
    ],
    client_name: 'Айбек',
    client_phone: '+996555123456',
    client_email: null,
};

function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>;
}

const headersOf = (call: number) => mockApiRequest.mock.calls[call][1]?.headers as Record<string, string>;

describe('useGuestBooking (C1)', () => {
    let store: Map<string, string>;

    beforeEach(() => {
        mockApiRequest.mockReset();
        store = new Map();
        jest.mocked(SecureStore.getItemAsync).mockImplementation(async (key) => store.get(key) ?? null);
        jest.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value) => { store.set(key, value); });
        jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async (key) => { store.delete(key); });
    });

    test('posts to quick-book-guest with a request id and a guest secret, as the website does', async () => {
        mockApiRequest.mockResolvedValueOnce({ ok: true, data: { booking_id: 'b-1', confirmed: true } });
        const onSuccess = jest.fn();
        const { result } = renderHook(() => useGuestBooking({ onSuccess }), { wrapper });

        await act(async () => {
            await result.current.createGuestBookingAsync(params);
        });

        expect(mockApiRequest.mock.calls[0][0]).toBe('/api/quick-book-guest');
        expect(JSON.parse(String(mockApiRequest.mock.calls[0][1]?.body))).toEqual(params);
        expect(headersOf(0)['Idempotency-Key']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        expect(headersOf(0)['X-Booking-Client-Token']).toMatch(/^[0-9a-f]{64}$/);
        expect(onSuccess).toHaveBeenCalledWith('b-1');
        // The confirmed attempt is done: nothing replayable stays, and the stored key never holds the phone.
        expect(store.size).toBe(0);
    });

    test('a retry after a lost answer replays the same identity; the stored key holds no contacts', async () => {
        mockApiRequest.mockRejectedValueOnce(new Error('Network response lost'));
        mockApiRequest.mockResolvedValueOnce({ data: { booking_id: 'b-2', confirmed: true } });
        const { result } = renderHook(() => useGuestBooking(), { wrapper });

        await act(async () => {
            await expect(result.current.createGuestBookingAsync(params)).rejects.toThrow('Network response lost');
        });
        expect([...store.keys()].join()).not.toContain('996555123456');
        await act(async () => {
            await result.current.createGuestBookingAsync(params);
        });

        expect(headersOf(1)).toEqual(headersOf(0));
    });

    test('an unconfirmed answer is not a booking', async () => {
        mockApiRequest.mockResolvedValueOnce({ data: { booking_id: 'hold', confirmed: false } });
        const onSuccess = jest.fn();
        const { result } = renderHook(() => useGuestBooking({ onSuccess }), { wrapper });

        await act(async () => {
            await expect(result.current.createGuestBookingAsync(params)).rejects.toThrow();
        });
        expect(onSuccess).not.toHaveBeenCalled();
    });
});
