import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { AppState, Linking, Text } from 'react-native';

import { supabase } from '../../lib/supabase';
import RootNavigator from '../../navigation/RootNavigator';

jest.mock('../../navigation/AuthNavigator', () => function AuthNavigatorMock() {
    return <Text>Auth Navigator</Text>;
});

jest.mock('../../navigation/MainNavigator', () => function MainNavigatorMock() {
    return <Text>Main Navigator</Text>;
});

jest.mock('../../contexts/BookingContext', () => ({
    BookingProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../../components/BookingCancelButton', () => function BookingCancelButtonMock() {
    return <Text>Cancel</Text>;
});

jest.mock('../../screens/BookingDetailsScreen', () => function BookingDetailsScreenMock() {
    return <Text>Booking Details Screen</Text>;
});

jest.mock('../../screens/BookingScreen', () => function BookingScreenMock() {
    return <Text>Booking Screen</Text>;
});

jest.mock('../../screens/booking/BookingStep1Branch', () => function BookingStep1BranchMock() {
    return <Text>Booking Step 1</Text>;
});

jest.mock('../../screens/booking/BookingStep2Service', () => function BookingStep2ServiceMock() {
    return <Text>Booking Step 2</Text>;
});

jest.mock('../../screens/booking/BookingStep3Staff', () => function BookingStep3StaffMock() {
    return <Text>Booking Step 3</Text>;
});

jest.mock('../../screens/booking/BookingStep4Date', () => function BookingStep4DateMock() {
    return <Text>Booking Step 4</Text>;
});

jest.mock('../../screens/booking/BookingStep5Time', () => function BookingStep5TimeMock() {
    return <Text>Booking Step 5</Text>;
});

jest.mock('../../screens/booking/BookingStep6Confirm', () => function BookingStep6ConfirmMock() {
    return <Text>Booking Step 6</Text>;
});

jest.mock('../../screens/ShiftsScreen', () => function ShiftsScreenMock() {
    return <Text>Shifts Screen</Text>;
});

jest.mock('../../screens/ShiftQuickScreen', () => function ShiftQuickScreenMock() {
    return <Text>Shift Quick Screen</Text>;
});

jest.mock('@react-navigation/native', () => ({
    NavigationContainer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@react-navigation/native-stack', () => {
    const React = require('react');

    const renderFirstScreen = (children: React.ReactNode): React.ReactNode => {
        const items = React.Children.toArray(children);

        for (const item of items) {
            if (!React.isValidElement(item)) continue;

            if (item.type === React.Fragment) {
                const nested = renderFirstScreen(item.props.children);
                if (nested) return nested;
                continue;
            }

            if (item.props.component) {
                const Component = item.props.component;
                return <Component />;
            }
        }

        return null;
    };

    return {
        createNativeStackNavigator: () => ({
            Navigator: ({ children }: { children: React.ReactNode }) => <>{renderFirstScreen(children)}</>,
            Screen: ({ children }: { children?: React.ReactNode }) => <>{children ?? null}</>,
        }),
    };
});

describe('RootNavigator', () => {
    const auth = supabase.auth as {
        getSession: jest.Mock;
        onAuthStateChange: jest.Mock;
        setSession: jest.Mock;
        exchangeCodeForSession: jest.Mock;
    };

    beforeEach(() => {
        jest.clearAllMocks();

        auth.getSession.mockResolvedValue({ data: { session: null } });
        auth.setSession.mockResolvedValue({ error: null });
        auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
        auth.onAuthStateChange.mockReturnValue({
            data: { subscription: { unsubscribe: jest.fn() } },
        });

        jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
        jest.spyOn(Linking, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
        jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);

        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('renders auth navigator when there is no active session', async () => {
        render(<RootNavigator />);

        await waitFor(() => {
            expect(screen.getByText('Auth Navigator')).toBeTruthy();
        });
    });

    test('renders main navigator when session exists on bootstrap', async () => {
        auth.getSession.mockResolvedValueOnce({
            data: {
                session: {
                    user: { id: 'user-1' },
                },
            },
        });

        render(<RootNavigator />);

        await waitFor(() => {
            expect(screen.getByText('Main Navigator')).toBeTruthy();
        });
    });

    test('exchanges mobile deep link code via API and sets session', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
            }),
        });

        jest.spyOn(Linking, 'getInitialURL').mockResolvedValueOnce('kezek://auth/callback?exchange_code=code-123');

        render(<RootNavigator />);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/auth/mobile-exchange?code=code-123'));
            expect(auth.setSession).toHaveBeenCalledWith({
                access_token: 'access-token',
                refresh_token: 'refresh-token',
            });
        });
    });
});
