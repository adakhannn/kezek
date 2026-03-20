import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import CabinetScreen from '../../screens/CabinetScreen';
import { useCabinetData } from '../../screens/cabinet/useCabinetData';

jest.mock('@react-navigation/native', () => {
    const actualNav = jest.requireActual('@react-navigation/native');
    return {
        ...actualNav,
        useNavigation: () => ({
            navigate: jest.fn(),
            goBack: jest.fn(),
        }),
    };
});

jest.mock('../../screens/cabinet/useCabinetData', () => ({
    useCabinetData: jest.fn(),
}));

const mockUseCabinetData = useCabinetData as jest.MockedFunction<typeof useCabinetData>;

describe('CabinetScreen', () => {
    beforeEach(() => {
        mockUseCabinetData.mockReturnValue({
            user: { email: 'user@example.com' } as never,
            bookings: [],
            isLoading: false,
            refreshing: false,
            onRefresh: jest.fn(),
            isOfflineSource: false,
            lastSyncAt: null,
            upcomingBookings: [],
            pastBookings: [],
        });
    });

    test('renders upcoming empty state by default', () => {
        render(<CabinetScreen />);

        expect(screen.getByTestId('cabinet-screen')).toBeTruthy();
        expect(screen.getByText('Мои записи')).toBeTruthy();
        expect(screen.getByText('У вас пока нет записей')).toBeTruthy();
    });

    test('switches to history tab and renders past empty state', () => {
        render(<CabinetScreen />);

        fireEvent.press(screen.getByText('История'));

        expect(screen.getByText('У вас пока нет прошедших записей')).toBeTruthy();
    });

    test('renders offline banner when offline cache is used', () => {
        mockUseCabinetData.mockReturnValue({
            user: { email: 'user@example.com' } as never,
            bookings: [],
            isLoading: false,
            refreshing: false,
            onRefresh: jest.fn(),
            isOfflineSource: true,
            lastSyncAt: '2026-03-20T08:00:00.000Z',
            upcomingBookings: [],
            pastBookings: [],
        });

        render(<CabinetScreen />);

        expect(screen.getByText(/Нет подключения к интернету/i)).toBeTruthy();
    });
});
