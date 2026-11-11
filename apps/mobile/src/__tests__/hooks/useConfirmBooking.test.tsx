import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { apiRequest } from '../../lib/api';
import { useConfirmBooking } from '../../hooks/useConfirmBooking';
import { createTestQueryClient } from '../testQueryClient';
import * as SecureStore from 'expo-secure-store';

jest.mock('../../lib/api', () => ({
    apiRequest: jest.fn(),
}));

const mockApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;

function createWrapper() {
    const queryClient = createTestQueryClient();

    return function Wrapper({ children }: { children: React.ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };
}

const params = {
    biz_id: 'biz-1',
    branch_id: 'branch-1',
    service_id: 'service-1',
    staff_id: 'staff-1',
    start_at: '2026-06-02T13:00:00+06:00',
};

describe('useConfirmBooking', () => {
    beforeEach(() => {
        mockApiRequest.mockReset();
        const store = new Map<string, string>();
        jest.mocked(SecureStore.getItemAsync).mockImplementation(async key => store.get(key) ?? null);
        jest.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value) => { store.set(key, value); });
        jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async key => { store.delete(key); });
    });

    test('extracts booking id from standard quick-hold API envelope', async () => {
        const onSuccess = jest.fn();
        mockApiRequest.mockResolvedValueOnce({
            ok: true,
            data: {
                booking_id: 'booking-123',
                confirmed: true,
            },
        });

        const { result } = renderHook(() => useConfirmBooking({ onSuccess }), {
            wrapper: createWrapper(),
        });

        await act(async () => {
            await result.current.createBookingAsync(params);
        });

        expect(onSuccess).toHaveBeenCalledWith('booking-123');
    });

    test('fails instead of navigating when quick-hold response has no booking id', async () => {
        const onSuccess = jest.fn();
        const onError = jest.fn();
        mockApiRequest.mockResolvedValueOnce({
            ok: true,
            data: {},
        });

        const { result } = renderHook(() => useConfirmBooking({ onSuccess, onError }), {
            wrapper: createWrapper(),
        });

        await act(async () => {
            await expect(result.current.createBookingAsync(params)).rejects.toThrow(
                'Не удалось получить номер созданной записи',
            );
        });

        await waitFor(() => expect(onError).toHaveBeenCalled());
        expect(onSuccess).not.toHaveBeenCalled();
    });

    test('manual retry after a lost response reuses the persisted request identity', async () => {
        mockApiRequest.mockRejectedValueOnce(new Error('Network response lost'));
        mockApiRequest.mockResolvedValueOnce({ data: { booking_id: 'same-booking', confirmed: true } });
        const { result } = renderHook(() => useConfirmBooking(), { wrapper: createWrapper() });
        await act(async () => {
            await expect(result.current.createBookingAsync(params)).rejects.toThrow('Network response lost');
            await expect(result.current.createBookingAsync(params)).resolves.toMatchObject({ booking_id: 'same-booking' });
        });
        const first = mockApiRequest.mock.calls[0][1]?.headers;
        expect(first).toHaveProperty('Idempotency-Key');
        expect(mockApiRequest.mock.calls[1][1]?.headers).toEqual(first);
    });

    test('an unconfirmed response cannot report booking success', async () => {
        const onSuccess = jest.fn();
        mockApiRequest.mockResolvedValueOnce({ data: { booking_id: 'hold-only', confirmed: false } });
        const { result } = renderHook(() => useConfirmBooking({ onSuccess }), { wrapper: createWrapper() });
        await act(async () => {
            await expect(result.current.createBookingAsync(params)).rejects.toThrow();
        });
        expect(onSuccess).not.toHaveBeenCalled();
    });
});
