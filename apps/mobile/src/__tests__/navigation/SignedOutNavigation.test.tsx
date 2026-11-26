/**
 * C1 (Apple 5.1.1): the app is browsable without an account. RootNavigator with the real React
 * Navigation and linking config; the screens are stand-ins, the session is controlled here.
 */
import React from 'react';
import { Linking } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';

import RootNavigator from '../../navigation/RootNavigator';
import { createTestQueryClient } from '../testQueryClient';

jest.mock('@react-navigation/native', () => jest.requireActual('@react-navigation/native'));

const mockSessionState: { session: { user: { id: string } } | null } = { session: null };

jest.mock('../../navigation/useRootNavigationSession', () => ({
    useRootNavigationSession: () => ({
        loading: false,
        session: mockSessionState.session,
        hasSession: mockSessionState.session !== null,
    }),
}));

jest.mock('../../hooks/useUserRole', () => ({
    useUserRole: () => ({ isOwner: false, isStaff: false, isSuperAdmin: false, isLoading: false, loadError: null }),
}));

jest.mock('../../lib/pushNotifications', () => ({
    initialNotificationUrl: jest.fn(async () => null),
    subscribeToNotificationTaps: jest.fn(() => () => undefined),
}));

function mockScreen(label: string, param?: string) {
    return function MockScreen() {
        const { Text } = jest.requireActual('react-native') as typeof import('react-native');
        const { useRoute } = jest.requireActual('@react-navigation/native') as typeof import('@react-navigation/native');
        const route = useRoute();
        const params = (route.params ?? {}) as Record<string, string>;
        return <Text>{param ? `${label}:${params[param]}` : label}</Text>;
    };
}

jest.mock('../../screens/HomeScreen', () => mockScreen('home-screen'));
jest.mock('../../screens/MapScreen', () => mockScreen('map-screen'));
jest.mock('../../screens/BookingScreen', () => mockScreen('booking-screen', 'slug'));
jest.mock('../../screens/business/BusinessScreen', () => mockScreen('business-screen', 'slug'));
jest.mock('../../screens/BookingDetailsScreen', () => mockScreen('booking-details', 'id'));
jest.mock('../../screens/CabinetScreen', () => mockScreen('cabinet-screen'));
jest.mock('../../screens/ProfileScreen', () => mockScreen('profile-screen'));
jest.mock('../../screens/DashboardScreen', () => mockScreen('dashboard-screen'));
jest.mock('../../screens/StaffScreen', () => mockScreen('staff-screen'));
jest.mock('../../screens/ShiftsScreen', () => mockScreen('shifts-screen'));
jest.mock('../../screens/ShiftQuickScreen', () => mockScreen('shift-quick-screen'));
jest.mock('../../screens/auth/SignInScreen', () => mockScreen('sign-in-screen'));
jest.mock('../../screens/auth/VerifyScreen', () => mockScreen('verify-screen'));
jest.mock('../../screens/auth/WhatsAppScreen', () => mockScreen('whatsapp-screen'));
jest.mock('../../screens/booking/BookingStep1Branch', () => mockScreen('step1'));
jest.mock('../../screens/booking/BookingStep2Service', () => mockScreen('step2'));
jest.mock('../../screens/booking/BookingStep3Staff', () => mockScreen('step3'));
jest.mock('../../screens/booking/BookingStep4Date', () => mockScreen('step4'));
jest.mock('../../screens/booking/BookingStep5Time', () => mockScreen('step5'));
jest.mock('../../screens/booking/BookingStep6Confirm', () => mockScreen('step6'));
jest.mock('../../components/BookingCancelButton', () => () => null);

describe('signed-out navigation (C1)', () => {
    const queryClient = createTestQueryClient();
    let initialUrl: string | null = null;
    let initialUrlSpy: jest.SpyInstance;

    const tree = () => (
        <QueryClientProvider client={queryClient}>
            <RootNavigator />
        </QueryClientProvider>
    );

    beforeEach(() => {
        mockSessionState.session = null;
        initialUrl = null;
        initialUrlSpy = jest.spyOn(Linking, 'getInitialURL').mockImplementation(async () => initialUrl);
    });

    afterEach(() => {
        initialUrlSpy.mockRestore();
        queryClient.clear();
    });

    test('opens on the home screen, not the sign-in, and the Cabinet tab offers the sign-in', async () => {
        render(tree());

        // The first render of the real navigators is slow under Jest.
        expect(await screen.findByText('home-screen', {}, { timeout: 15000 })).toBeTruthy();
        expect(screen.queryByText('sign-in-screen')).toBeNull();

        fireEvent.press(screen.getByLabelText('Кабинет'));

        expect(await screen.findByText('Войдите в аккаунт')).toBeTruthy();
        expect(screen.queryByText('cabinet-screen')).toBeNull();

        fireEvent.press(screen.getByText('Войти'));
        expect(await screen.findByText('sign-in-screen')).toBeTruthy();
    });

    test('a business link opens the public business page and its booking flow without an account', async () => {
        initialUrl = 'kezek://b/salon-1';
        const view = render(tree());

        expect(await screen.findByText('business-screen:salon-1')).toBeTruthy();
        view.unmount();

        initialUrl = 'https://kezek.vercel.app/b/salon-2/booking';
        render(tree());
        expect(await screen.findByText('booking-screen:salon-2')).toBeTruthy();
    });

    test('a booking link opened signed out is kept and shown after the sign-in', async () => {
        initialUrl = 'kezek://booking/booking-42';
        const view = render(tree());

        expect(await screen.findByText('Войдите в аккаунт')).toBeTruthy();
        expect(screen.queryByText('booking-details:booking-42')).toBeNull();

        fireEvent.press(screen.getByText('Войти'));
        expect(await screen.findByText('sign-in-screen')).toBeTruthy();

        // The sign-in completes: the Auth screen leaves the stack and the booking is underneath.
        mockSessionState.session = { user: { id: 'user-1' } };
        await act(async () => {
            view.rerender(tree());
        });

        expect(await screen.findByText('booking-details:booking-42')).toBeTruthy();
        expect(screen.queryByText('sign-in-screen')).toBeNull();
    });

    test('closing the sign-in returns to the screen that opened it', async () => {
        render(tree());

        fireEvent.press(await screen.findByLabelText('Кабинет'));
        fireEvent.press(await screen.findByText('Войти'));
        expect(await screen.findByText('sign-in-screen')).toBeTruthy();

        fireEvent.press(screen.getByLabelText('Закрыть вход'));
        expect(await screen.findByText('Войдите в аккаунт')).toBeTruthy();
    });
});
