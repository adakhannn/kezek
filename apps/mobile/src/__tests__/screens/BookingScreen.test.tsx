import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import BookingScreen from '../../screens/BookingScreen';

jest.mock('@react-navigation/native', () => ({
    NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
    useRoute: () => ({
        params: {
            slug: 'test-salon',
        },
    }),
}));

jest.mock('../../lib/analytics', () => ({
    trackMobileEvent: jest.fn(),
}));

jest.mock('../../screens/booking/BookingStep1Branch', () => {
    const React = require('react');
    const { Text } = require('react-native');

    return function MockBookingStep1Branch() {
        return <Text testID="booking-step-1">Booking Step 1</Text>;
    };
});

jest.mock('../../contexts/BookingContext', () => ({
    useBooking: () => ({
        bookingData: {
            business: {
                id: 'biz-1',
                name: 'Test Salon',
            },
        },
        setBusiness: jest.fn(),
        setBranches: jest.fn(),
        setServices: jest.fn(),
        setStaff: jest.fn(),
        setPromotions: jest.fn(),
        setBranchId: jest.fn(),
    }),
}));

describe('BookingScreen', () => {
    const renderWithProviders = (component: React.ReactElement) => {
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        });

        return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
    };

    test('renders booking step after init load', async () => {
        renderWithProviders(<BookingScreen />);

        expect(await screen.findByTestId('booking-step-1')).toBeTruthy();
    });
});
