import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { apiRequest } from '../../lib/api';
import { useConfirmBooking } from '../../hooks/useConfirmBooking';

jest.mock('../../lib/api', () => ({
    apiRequest: jest.fn(),
}));

const mockApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    });

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
});
