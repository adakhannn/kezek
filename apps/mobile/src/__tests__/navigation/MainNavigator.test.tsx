import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';

import MainNavigator from '../../navigation/MainNavigator';
import { useUserRole } from '../../hooks/useUserRole';
import { createTestQueryClient } from '../testQueryClient';

jest.mock('../../hooks/useUserRole', () => ({
    useUserRole: jest.fn(),
}));

const mockedUseUserRole = useUserRole as jest.MockedFunction<typeof useUserRole>;

jest.mock('@react-navigation/bottom-tabs', () => ({
    createBottomTabNavigator: () => {
        const React = require('react');
        const { Text } = require('react-native');
        const mockNavigatorSpy =
            (globalThis as { __mockNavigatorSpy?: jest.Mock }).__mockNavigatorSpy ?? jest.fn();
        (globalThis as { __mockNavigatorSpy?: jest.Mock }).__mockNavigatorSpy = mockNavigatorSpy;

        return {
            Navigator: ({
                children,
                ...props
            }: {
                children: React.ReactNode;
                backBehavior?: string;
            }) => {
                mockNavigatorSpy(props);
                return <>{children}</>;
            },
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
    const mockNavigatorSpy = (globalThis as { __mockNavigatorSpy?: jest.Mock }).__mockNavigatorSpy;

    beforeEach(() => {
        mockNavigatorSpy?.mockClear();
        mockedUseUserRole.mockReturnValue({
            isOwner: true,
            isStaff: true,
            isSuperAdmin: false,
            isLoading: false,
            loadError: null,
        });
    });

    const renderWithProviders = (component: React.ReactElement) => {
        const queryClient = createTestQueryClient();

        return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
    };

    test('renders main tab entries', () => {
        renderWithProviders(<MainNavigator />);

        expect(screen.getByText('Home')).toBeTruthy();
        expect(screen.getByText('Cabinet')).toBeTruthy();
        expect(screen.getByText('Dashboard')).toBeTruthy();
        expect(screen.getByText('Staff')).toBeTruthy();
    });

    test('uses history back behavior for Android tab navigation', () => {
        renderWithProviders(<MainNavigator />);

        expect(mockNavigatorSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                backBehavior: 'history',
            }),
        );
    });

    test('hides role-specific tabs for a client-only user', () => {
        mockedUseUserRole.mockReturnValue({
            isOwner: false,
            isStaff: false,
            isSuperAdmin: false,
            isLoading: false,
            loadError: null,
        });

        renderWithProviders(<MainNavigator />);

        expect(screen.getByText('Home')).toBeTruthy();
        expect(screen.getByText('Cabinet')).toBeTruthy();
        expect(screen.queryByText('Dashboard')).toBeNull();
        expect(screen.queryByText('Staff')).toBeNull();
    });

    test('shows only the owner tab for an owner-only user', () => {
        mockedUseUserRole.mockReturnValue({
            isOwner: true,
            isStaff: false,
            isSuperAdmin: false,
            isLoading: false,
            loadError: null,
        });

        renderWithProviders(<MainNavigator />);

        expect(screen.getByText('Dashboard')).toBeTruthy();
        expect(screen.queryByText('Staff')).toBeNull();
    });

    test('shows only the staff tab for a staff-only user', () => {
        mockedUseUserRole.mockReturnValue({
            isOwner: false,
            isStaff: true,
            isSuperAdmin: false,
            isLoading: false,
            loadError: null,
        });

        renderWithProviders(<MainNavigator />);

        expect(screen.queryByText('Dashboard')).toBeNull();
        expect(screen.getByText('Staff')).toBeTruthy();
    });
});
