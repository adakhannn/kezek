import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';

import BookingDetailsScreen from '../../screens/BookingDetailsScreen';
import { apiRequest } from '../../lib/api';
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
                start_at: '2024-01-01T10:00:00Z',
                end_at: '2024-01-01T11:00:00Z',
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
                start_at: '2024-01-01T10:00:00Z',
                end_at: '2024-01-01T11:00:00Z',
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
});
