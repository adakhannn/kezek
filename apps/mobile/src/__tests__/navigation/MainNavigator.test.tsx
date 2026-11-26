import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';

import MainNavigator from '../../navigation/MainNavigator';
import { NavigationSessionProvider, type NavigationSession } from '../../navigation/NavigationSessionContext';
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
            isBusinessManager: true,
            isStaff: true,
            isSuperAdmin: false,
            isLoading: false,
            loadError: null,
        });
    });

    const signedIn: NavigationSession = { session: { user: { id: 'user-1' } } as NavigationSession['session'], hasSession: true };

    const renderWithProviders = (component: React.ReactElement, session = signedIn) => {
        const queryClient = createTestQueryClient();

        return render(
            <QueryClientProvider client={queryClient}>
                <NavigationSessionProvider value={session}>{component}</NavigationSessionProvider>
            </QueryClientProvider>,
        );
    };

    test('renders main tab entries', () => {
        renderWithProviders(<MainNavigator />);

        expect(screen.getByText('Home')).toBeTruthy();
        expect(screen.getByText('Cabinet')).toBeTruthy();
        expect(screen.getByText('Dashboard')).toBeTruthy();
        expect(screen.getByText('Staff')).toBeTruthy();
    });

    test('signed out: Home and the Cabinet tab (its sign-in entry), no role tabs (C1)', () => {
        renderWithProviders(<MainNavigator />, { session: null, hasSession: false });

        expect(screen.getByText('Home')).toBeTruthy();
        expect(screen.getByText('Cabinet')).toBeTruthy();
        expect(screen.queryByText('Dashboard')).toBeNull();
        expect(screen.queryByText('Staff')).toBeNull();
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
            isBusinessManager: false,
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
            isBusinessManager: true,
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
            isBusinessManager: false,
            isStaff: true,
            isSuperAdmin: false,
            isLoading: false,
            loadError: null,
        });

        renderWithProviders(<MainNavigator />);

        expect(screen.queryByText('Dashboard')).toBeNull();
        expect(screen.getByText('Staff')).toBeTruthy();
    });

    test('an admin or manager of a business without owning one gets the Business tab (O3/B10)', () => {
        mockedUseUserRole.mockReturnValue({
            isOwner: false,
            isBusinessManager: true,
            isStaff: false,
            isSuperAdmin: false,
            isLoading: false,
            loadError: null,
        });

        renderWithProviders(<MainNavigator />);

        expect(screen.getByText('Dashboard')).toBeTruthy();
    });

    test('a super admin who is a master sees the staff tab and no business tab of their own (O3)', () => {
        mockedUseUserRole.mockReturnValue({
            isOwner: false,
            isBusinessManager: false,
            isStaff: true,
            isSuperAdmin: true,
            isLoading: false,
            loadError: null,
        });

        renderWithProviders(<MainNavigator />);

        expect(screen.queryByText('Dashboard')).toBeNull();
        expect(screen.getByText('Staff')).toBeTruthy();
    });
});
