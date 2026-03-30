import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import BookingStep1Branch from '../../screens/booking/BookingStep1Branch';
import BookingStep2Service from '../../screens/booking/BookingStep2Service';
import BookingStep3Staff from '../../screens/booking/BookingStep3Staff';
import BookingStep4Date from '../../screens/booking/BookingStep4Date';
import BookingStep5Time from '../../screens/booking/BookingStep5Time';
import BookingStep6Confirm from '../../screens/booking/BookingStep6Confirm';
import { BookingProvider } from '../../contexts/BookingContext';

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        navigate: jest.fn(),
        goBack: jest.fn(),
        setOptions: jest.fn(),
    }),
    useRoute: () => ({
        params: {
            slug: 'test-business-slug',
        },
    }),
}));

jest.mock('../../hooks/useBusinessWithBranches', () => ({
    useBusinessWithBranches: () => ({
        isLoading: false,
        data: {
            business: {
                id: 'test-business-id',
                name: 'Test Salon',
                slug: 'test-business-slug',
                rating_score: 4.8,
            },
            branches: [
                {
                    id: 'branch-1',
                    name: 'Main Branch',
                    rating_score: 4.7,
                },
            ],
        },
    }),
}));

jest.mock('../../hooks/useConfirmBooking', () => ({
    useConfirmBooking: () => ({
        createBooking: jest.fn(),
        isPending: false,
    }),
}));

describe('Booking Navigation', () => {
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
                <BookingProvider>{component}</BookingProvider>
            </QueryClientProvider>,
        );
    };

    test('renders booking step 1 branch screen', async () => {
        renderWithProviders(<BookingStep1Branch />);

        expect(await screen.findByText('Test Salon')).toBeTruthy();
        expect(await screen.findByText('Main Branch')).toBeTruthy();
    });

    test('renders booking step 2 service screen', async () => {
        renderWithProviders(<BookingStep2Service />);

        expect(await screen.findByText('Нет доступных услуг')).toBeTruthy();
    });

    test('renders booking step 3 staff screen', async () => {
        renderWithProviders(<BookingStep3Staff />);

        expect(await screen.findByText('Нет доступных мастеров')).toBeTruthy();
    });

    test('renders booking step 4 date screen', async () => {
        renderWithProviders(<BookingStep4Date />);

        expect(await screen.findByText(/Сегодня/i)).toBeTruthy();
    });

    test('renders booking step 5 time screen', async () => {
        renderWithProviders(<BookingStep5Time />);

        expect(await screen.findByText('Нет доступного времени')).toBeTruthy();
    });

    test('renders booking step 6 confirm screen', async () => {
        renderWithProviders(<BookingStep6Confirm />);

        expect(await screen.findByText('Тестовая услуга')).toBeTruthy();
        expect(await screen.findByText('Записаться')).toBeTruthy();
    });
});
