import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import MainNavigator from '../../navigation/MainNavigator';

jest.mock('../../hooks/useUserRole', () => ({
    useUserRole: () => ({
        isOwner: true,
        isStaff: true,
        isLoading: false,
    }),
}));

jest.mock('@react-navigation/bottom-tabs', () => ({
    createBottomTabNavigator: () => {
        const React = require('react');
        const { Text } = require('react-native');

        return {
            Navigator: ({ children }: { children: React.ReactNode }) => <>{children}</>,
            Screen: ({ name }: { name: string }) => <Text>{name}</Text>,
        };
    },
}));

jest.mock('@react-navigation/native-stack', () => ({
    createNativeStackNavigator: () => {
        const React = require('react');
        const { Text } = require('react-native');

        return {
            Navigator: ({ children }: { children: React.ReactNode }) => <>{children}</>,
            Screen: ({ name }: { name: string }) => <Text>{name}</Text>,
        };
    },
}));

describe('MainNavigator', () => {
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

    test('renders main tab entries', () => {
        renderWithProviders(<MainNavigator />);

        expect(screen.getByText('Home')).toBeTruthy();
        expect(screen.getByText('Cabinet')).toBeTruthy();
        expect(screen.getByText('Dashboard')).toBeTruthy();
        expect(screen.getByText('Staff')).toBeTruthy();
    });
});
