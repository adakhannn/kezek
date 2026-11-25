import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';

import BookingDetailsScreen from '../../screens/BookingDetailsScreen';
import * as SecureStore from 'expo-secure-store';

import { apiRequest } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { createTestQueryClient } from '../testQueryClient';

let mockRouteId = 'test-booking-id';
const mockNavigationReset = jest.fn();

jest.mock('@react-navigation/native', () => ({
    NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
    useNavigation: () => ({
        navigate: jest.fn(),
        goBack: jest.fn(),
        reset: mockNavigationReset,
    }),
    useRoute: () => ({
        params: {
            id: mockRouteId,
        },
    }),
}));

jest.mock('../../lib/api', () => ({
    apiRequest: jest.fn(),
}));

describe('BookingDetailsScreen', () => {
    const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;

    const renderWithProviders = (component: React.ReactElement) => {
        const queryClient = createTestQueryClient();

        return render(
            <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>,
        );
    };

    beforeEach(() => {
        mockRouteId = 'test-booking-id';
        mockNavigationReset.mockReset();
        mockedApiRequest.mockResolvedValue({
            ok: true,
            data: {
                id: 'test-booking-id',
                start_at: '2099-01-01T10:00:00Z',
                end_at: '2099-01-01T11:00:00Z',
                status: 'confirmed',
                service: {
                    name_ru: 'Тестовая услуга',
                    duration_min: 60,
                    price_from: 1000,
                    price_to: 1500,
                },
                staff: {
                    full_name: 'Тестовый мастер',
                },
                business: {
                    name: 'Тестовый бизнес',
                    slug: 'test-business',
                    phones: ['+996555000111'],
                },
                branch: {
                    name: 'Главный филиал',
                    address: 'Some street',
                },
            },
        } as never);
    });

    afterEach(() => {
        mockedApiRequest.mockReset();
    });

    test('renders booking details content', async () => {
        renderWithProviders(<BookingDetailsScreen />);

        expect(await screen.findByTestId('booking-details-screen')).toBeTruthy();
        expect(await screen.findByText('Тестовая услуга')).toBeTruthy();
        expect(await screen.findByText('Тестовый бизнес')).toBeTruthy();
    });

    test('shows the booking time in Asia/Bishkek when the server sends no zone', async () => {
        renderWithProviders(<BookingDetailsScreen />);

        expect(await screen.findByText('16:00 - 17:00')).toBeTruthy();
    });

    test('shows the booking time in the business time zone (ARCH-11)', async () => {
        mockedApiRequest.mockResolvedValue({
            ok: true,
            data: {
                id: 'test-booking-id',
                start_at: '2099-01-01T10:00:00Z',
                end_at: '2099-01-01T11:00:00Z',
                status: 'confirmed',
                service: { name_ru: 'Тестовая услуга', duration_min: 60, price_from: 1000, price_to: 1500 },
                staff: { full_name: 'Тестовый мастер' },
                business: { name: 'Московский бизнес', slug: 'moscow', phones: [], tz: 'Europe/Moscow' },
                branch: { name: 'Главный филиал', address: 'Some street' },
            },
        } as never);

        renderWithProviders(<BookingDetailsScreen />);

        // 10:00Z is 13:00 in Moscow (UTC+3); the Bishkek default would show 16:00.
        expect(await screen.findByText('13:00 - 14:00')).toBeTruthy();
        expect(screen.queryByText('16:00 - 17:00')).toBeNull();
    });

    test('renders repeat booking action', async () => {
        renderWithProviders(<BookingDetailsScreen />);

        expect(await screen.findByText('Повторить запись')).toBeTruthy();
    });

    test('allows cancelling confirmed upcoming booking', async () => {
        renderWithProviders(<BookingDetailsScreen />);

        expect(await screen.findByText('Отменить бронирование')).toBeTruthy();
    });

    test('returns to Cabinet after cancelling instead of an emptied booking flow', async () => {
        renderWithProviders(<BookingDetailsScreen />);

        fireEvent.press(await screen.findByText('Отменить бронирование'));

        await waitFor(() => {
            expect(mockNavigationReset).toHaveBeenCalledWith({
                index: 0,
                routes: [
                    {
                        name: 'Main',
                        params: {
                            screen: 'Cabinet',
                            params: { screen: 'CabinetMain' },
                        },
                    },
                ],
            });
        });
    });

    test('shows not-found state when deep-linked booking id cannot be loaded', async () => {
        mockRouteId = 'missing-booking-id';
        mockedApiRequest.mockRejectedValue(new Error('booking not found'));

        renderWithProviders(<BookingDetailsScreen />);

        expect(await screen.findByText('Бронирование не найдено')).toBeTruthy();
        expect(screen.queryByText('Тестовая услуга')).toBeNull();
    });
    // R25-10: the client's own actions end at the start of the visit.
    test('a started booking offers no cancel or reschedule and says why', async () => {
        const startedAt = new Date(Date.now() - 10 * 60_000).toISOString();
        const endsAt = new Date(Date.now() + 50 * 60_000).toISOString();
        mockedApiRequest.mockResolvedValue({
            ok: true,
            data: {
                id: 'test-booking-id', start_at: startedAt, end_at: endsAt, status: 'confirmed',
                biz_id: 'biz-1', branch_id: 'branch-1', staff_id: 'staff-1', benefit_applied: false,
                service: { name_ru: 'Тестовая услуга', duration_min: 60, price_from: null, price_to: null },
                staff: { full_name: 'Тестовый мастер' },
                business: { name: 'Тестовый бизнес', slug: 'test-business', phones: [] },
                branch: { name: 'Главный филиал', address: null },
            },
        } as never);

        renderWithProviders(<BookingDetailsScreen />);

        expect(await screen.findByTestId('booking-started-notice')).toBeTruthy();
        expect(screen.queryByText('Отменить бронирование')).toBeNull();
        expect(screen.queryByText('Перенести запись')).toBeNull();
    });

    test('a booking with a benefit is not rescheduled by the client', async () => {
        mockedApiRequest.mockResolvedValue({
            ok: true,
            data: {
                id: 'test-booking-id', start_at: '2099-01-01T10:00:00Z', end_at: '2099-01-01T11:00:00Z', status: 'confirmed',
                biz_id: 'biz-1', branch_id: 'branch-1', staff_id: 'staff-1', benefit_applied: true,
                service: null, staff: null, business: { name: 'Тестовый бизнес', slug: 'test-business', phones: [] }, branch: null,
            },
        } as never);

        renderWithProviders(<BookingDetailsScreen />);

        expect(await screen.findByText('Отменить бронирование')).toBeTruthy();
        expect(screen.queryByText('Перенести запись')).toBeNull();
        expect(screen.getByText('Запись с акцией или абонементом переносит организация: свяжитесь с ней.')).toBeTruthy();
    });

    test('reschedules to a free start of the same master with an idempotency key', async () => {
        const store = new Map<string, string>();
        jest.mocked(SecureStore.getItemAsync).mockImplementation(async (key) => store.get(key) ?? null);
        jest.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value) => { store.set(key, value); });
        jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async (key) => { store.delete(key); });
        jest.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'user-1' } } }, error: null } as never);
        jest.mocked(supabase.rpc).mockResolvedValue({
            data: [
                { staff_id: 'staff-1', branch_id: 'branch-1', start_at: '2099-01-02T12:00:00+00:00', end_at: '2099-01-02T13:00:00+00:00' },
                { staff_id: 'staff-2', branch_id: 'branch-1', start_at: '2099-01-02T13:00:00+00:00', end_at: '2099-01-02T14:00:00+00:00' },
            ],
            error: null,
        } as never);
        const details = {
            id: 'test-booking-id', start_at: '2099-01-01T10:00:00Z', end_at: '2099-01-01T11:00:00Z', status: 'confirmed',
            biz_id: 'biz-1', branch_id: 'branch-1', staff_id: 'staff-1', benefit_applied: false,
            service: { name_ru: 'Тестовая услуга', duration_min: 60, price_from: null, price_to: null },
            staff: { full_name: 'Тестовый мастер' },
            business: { name: 'Тестовый бизнес', slug: 'test-business', phones: [] },
            branch: { name: 'Главный филиал', address: null },
        };
        mockedApiRequest.mockImplementation(async (endpoint: string) => (endpoint.endsWith('/reschedule')
            ? { ok: true, data: { booking_id: 'test-booking-id', rescheduled: true, start_at: '2099-01-02T12:00:00+00:00', end_at: '2099-01-02T13:00:00+00:00' } }
            : { ok: true, data: details }) as never);

        renderWithProviders(<BookingDetailsScreen />);

        fireEvent.press(await screen.findByText('Перенести запись'));
        expect(await screen.findByTestId('reschedule-sheet')).toBeTruthy();
        expect(jest.mocked(supabase.rpc)).toHaveBeenCalledWith('get_free_slots_complex_day_v1', expect.objectContaining({
            p_biz_id: 'biz-1', p_staff_id: 'staff-1', p_duration_min: 60,
        }));
        // 12:00Z is 18:00 in Asia/Bishkek; the other master's start is not offered.
        fireEvent.press(await screen.findByText('18:00'));
        expect(screen.queryByText('19:00')).toBeNull();
        fireEvent.press(screen.getByText('Перенести'));

        await waitFor(() => {
            expect(mockedApiRequest).toHaveBeenCalledWith('/api/bookings/test-booking-id/reschedule', expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ start_at: '2099-01-02T12:00:00+00:00' }),
                headers: expect.objectContaining({ 'Idempotency-Key': expect.stringMatching(/^[0-9a-f-]{36}$/) }),
            }));
        });
        await waitFor(() => expect(screen.queryByTestId('reschedule-sheet')).toBeNull());
    });
});
