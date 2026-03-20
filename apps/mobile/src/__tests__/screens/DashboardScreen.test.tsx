import React from 'react';
import { render, screen } from '@testing-library/react-native';

import DashboardScreen from '../../screens/DashboardScreen';
import { useDashboardScreen } from '../../screens/dashboard/useDashboardScreen';

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

jest.mock('../../screens/dashboard/useDashboardScreen', () => ({
    useDashboardScreen: jest.fn(),
}));

const mockUseDashboardScreen = useDashboardScreen as jest.MockedFunction<typeof useDashboardScreen>;

describe('DashboardScreen', () => {
    beforeEach(() => {
        mockUseDashboardScreen.mockReturnValue({
            refreshing: false,
            businesses: [],
            isLoading: false,
            isOwner: true,
            handleRefresh: jest.fn(),
        });
    });

    test('renders empty owner state when there are no businesses', () => {
        render(<DashboardScreen />);

        expect(screen.getByText('Кабинет бизнеса')).toBeTruthy();
        expect(screen.getByText('Нет бизнесов')).toBeTruthy();
    });

    test('renders business list when businesses are available', () => {
        mockUseDashboardScreen.mockReturnValue({
            refreshing: false,
            businesses: [
                {
                    id: 'biz-1',
                    name: 'Salon One',
                    slug: 'salon-one',
                    address: 'Main street 1',
                    phones: ['+7 777 000 00 00'],
                },
            ],
            isLoading: false,
            isOwner: true,
            handleRefresh: jest.fn(),
        });

        render(<DashboardScreen />);

        expect(screen.getByText('Salon One')).toBeTruthy();
        expect(screen.getByText('Main street 1')).toBeTruthy();
        expect(screen.getByText('+7 777 000 00 00')).toBeTruthy();
    });

    test('renders not-owner state when user has no owned businesses', () => {
        mockUseDashboardScreen.mockReturnValue({
            refreshing: false,
            businesses: [],
            isLoading: false,
            isOwner: false,
            handleRefresh: jest.fn(),
        });

        render(<DashboardScreen />);

        expect(screen.getByText('Вы не являетесь владельцем бизнеса')).toBeTruthy();
    });
});
