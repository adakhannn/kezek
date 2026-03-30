import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import BookingDetailsScreen from '../../screens/BookingDetailsScreen';

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
    apiRequest: jest.fn().mockResolvedValue({
        id: 'test-booking-id',
        start_at: '2024-01-01T10:00:00Z',
        end_at: '2024-01-01T11:00:00Z',
        status: 'confirmed',
        service: {
            name_ru: 'Тестовая услуга',
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
    }),
}));

describe('BookingDetailsScreen', () => {
    const renderWithProviders = (component: React.ReactElement) => {
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        });

        return render(
            <QueryClientProvider client={queryClient}>
                {component}
            </QueryClientProvider>,
        );
    };

    test('renders booking details content', async () => {
        renderWithProviders(<BookingDetailsScreen />);

        expect(await screen.findByText('Тестовая услуга')).toBeTruthy();
        expect(await screen.findByText('Тестовый бизнес')).toBeTruthy();
    });

    test('renders repeat booking action', async () => {
        renderWithProviders(<BookingDetailsScreen />);

        expect(await screen.findByText('Повторить запись')).toBeTruthy();
    });
});
