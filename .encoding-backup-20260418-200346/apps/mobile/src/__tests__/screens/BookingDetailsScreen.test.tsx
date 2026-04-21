import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';

import BookingDetailsScreen from '../../screens/BookingDetailsScreen';
import { apiRequest } from '../../lib/api';
import { createTestQueryClient } from '../testQueryClient';

jest.mock('@react-navigation/native', () => ({
    NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
    useNavigation: () => ({
        navigate: jest.fn(),
        goBack: jest.fn(),
    }),
    useRoute: () => ({
        params: {
            id: 'test-booking-id',
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
        mockedApiRequest.mockResolvedValue({
            id: 'test-booking-id',
            start_at: '2024-01-01T10:00:00Z',
            end_at: '2024-01-01T11:00:00Z',
            status: 'confirmed',
            service: {
                name_ru: '???????? ??????',
                duration_min: 60,
                price_from: 1000,
                price_to: 1500,
            },
            staff: {
                full_name: '???????? ??????',
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
        } as never);
    });

    afterEach(() => {
        mockedApiRequest.mockReset();
    });

    test('renders booking details content', async () => {
        renderWithProviders(<BookingDetailsScreen />);

        expect(await screen.findByTestId('booking-details-screen')).toBeTruthy();
        expect(await screen.findByText('???????? ??????')).toBeTruthy();
        expect(await screen.findByText('???????? ??????')).toBeTruthy();
    });

    test('renders repeat booking action', async () => {
        renderWithProviders(<BookingDetailsScreen />);

        expect(await screen.findByText('????????? ??????')).toBeTruthy();
    });
});
