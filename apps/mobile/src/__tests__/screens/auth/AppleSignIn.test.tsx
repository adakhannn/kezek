/**
 * Sign in with Apple (R25-06): iOS only, Apple's own button, native ID token to Supabase.
 */

import React from 'react';
import { createHash } from 'node:crypto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { appleFullNameToMetadata, loadAppleAuthentication } from '../../../lib/appleAuth';
import { supabase } from '../../../lib/supabase';
import SignInScreen from '../../../screens/auth/SignInScreen';

const mockShowToast = jest.fn();
const mockIsAvailableAsync = jest.fn();
const mockSignInAsync = jest.fn();

jest.mock('../../../contexts/ToastContext', () => ({
    useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock('../../../navigation/useRootNavigationSession', () => ({
    exchangeViaMobileApi: jest.fn(),
    getMobileApiUrl: () => 'https://kezek.example',
    handleDeepLinkAuth: jest.fn(),
}));

jest.mock('../../../lib/analytics', () => ({ trackMobileEvent: jest.fn() }));

jest.mock('expo-apple-authentication', () => {
    const { Pressable } = jest.requireActual('react-native');
    const ReactActual = jest.requireActual('react');
    return {
        isAvailableAsync: (...args: unknown[]) => mockIsAvailableAsync(...args),
        signInAsync: (...args: unknown[]) => mockSignInAsync(...args),
        AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
        AppleAuthenticationButtonType: { SIGN_IN: 0, CONTINUE: 1, SIGN_UP: 2 },
        AppleAuthenticationButtonStyle: { WHITE: 0, WHITE_OUTLINE: 1, BLACK: 2 },
        AppleAuthenticationButton: (props: { onPress: () => void; accessibilityLabel?: string }) =>
            ReactActual.createElement(Pressable, {
                testID: 'apple-native-button',
                onPress: props.onPress,
                accessibilityLabel: props.accessibilityLabel,
            }),
    };
});

type AuthMock = {
    getSession: jest.Mock;
    signInWithIdToken: jest.Mock;
    updateUser: jest.Mock;
};

const auth = supabase.auth as unknown as AuthMock;

function sha256Hex(value: string) {
    return createHash('sha256').update(value).digest('hex');
}

describe('Sign in with Apple', () => {
    beforeEach(() => {
        mockShowToast.mockReset();
        mockIsAvailableAsync.mockReset();
        mockIsAvailableAsync.mockResolvedValue(true);
        mockSignInAsync.mockReset();
        auth.signInWithIdToken = jest.fn().mockResolvedValue({
            data: { session: { access_token: 'a' }, user: { id: 'u1', user_metadata: {} } },
            error: null,
        });
        auth.updateUser.mockReset();
        auth.updateUser.mockResolvedValue({ data: { user: null }, error: null });
        auth.getSession.mockReset();
        auth.getSession.mockResolvedValue({ data: { session: null } });
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('the button is shown on iOS when Apple sign-in is available, before Google', async () => {
        render(<SignInScreen />);
        expect(await screen.findByTestId('apple-native-button')).toBeTruthy();
        const order = JSON.stringify(screen.toJSON());
        expect(order.indexOf('apple-native-button')).toBeLessThan(order.indexOf('Продолжить с Google'));
        expect(screen.getByLabelText('Продолжить с Apple')).toBeTruthy();
    });

    test('hidden on Android, where the module is never asked', async () => {
        jest.replaceProperty(Platform, 'OS', 'android');
        render(<SignInScreen />);
        await waitFor(() => expect(screen.getByText('Продолжить с Google')).toBeTruthy());
        expect(screen.queryByTestId('apple-native-button')).toBeNull();
        expect(mockIsAvailableAsync).not.toHaveBeenCalled();
        expect(loadAppleAuthentication()).toBeNull();
    });

    test('hidden on iOS when the device cannot use Apple sign-in', async () => {
        mockIsAvailableAsync.mockResolvedValue(false);
        render(<SignInScreen />);
        await waitFor(() => expect(mockIsAvailableAsync).toHaveBeenCalled());
        expect(screen.queryByTestId('apple-native-button')).toBeNull();
    });

    test('hidden when the availability check throws (a binary without the native module)', async () => {
        mockIsAvailableAsync.mockRejectedValue(new Error('Cannot find native module'));
        render(<SignInScreen />);
        await waitFor(() => expect(mockIsAvailableAsync).toHaveBeenCalled());
        expect(screen.queryByTestId('apple-native-button')).toBeNull();
    });

    test('success: Apple gets the SHA-256 of the nonce, Supabase the raw nonce; the first-time name is saved', async () => {
        mockSignInAsync.mockResolvedValue({
            identityToken: 'apple-id-token',
            authorizationCode: 'code',
            user: 'apple-user',
            fullName: { givenName: 'Айгерим', familyName: 'Садыкова' },
            email: 'abc@privaterelay.appleid.com',
        });

        render(<SignInScreen />);
        fireEvent.press(await screen.findByTestId('apple-native-button'));

        await waitFor(() => expect(auth.signInWithIdToken).toHaveBeenCalledTimes(1));
        const appleOptions = mockSignInAsync.mock.calls[0][0] as { nonce: string; requestedScopes: number[] };
        const supabaseArgs = auth.signInWithIdToken.mock.calls[0][0] as { provider: string; token: string; nonce: string };

        expect(supabaseArgs.provider).toBe('apple');
        expect(supabaseArgs.token).toBe('apple-id-token');
        expect(supabaseArgs.nonce).toMatch(/^[a-f0-9]{64}$/);
        expect(appleOptions.nonce).toBe(sha256Hex(supabaseArgs.nonce));
        expect(appleOptions.nonce).not.toBe(supabaseArgs.nonce);
        expect(appleOptions.requestedScopes).toEqual([0, 1]);

        await waitFor(() =>
            expect(auth.updateUser).toHaveBeenCalledWith({
                data: {
                    full_name: 'Айгерим Садыкова',
                    name: 'Айгерим Садыкова',
                    given_name: 'Айгерим',
                    family_name: 'Садыкова',
                },
            }),
        );
        expect(mockShowToast).toHaveBeenCalledWith('Вход выполнен успешно', 'success');
    });

    test('a later sign-in without a name leaves the stored name alone', async () => {
        mockSignInAsync.mockResolvedValue({
            identityToken: 'apple-id-token',
            authorizationCode: 'code',
            user: 'apple-user',
            fullName: null,
        });

        render(<SignInScreen />);
        fireEvent.press(await screen.findByTestId('apple-native-button'));

        await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('Вход выполнен успешно', 'success'));
        expect(auth.updateUser).not.toHaveBeenCalled();
    });

    test('cancelling Apple sheet is silent', async () => {
        mockSignInAsync.mockRejectedValue(Object.assign(new Error('The user canceled'), { code: 'ERR_REQUEST_CANCELED' }));

        render(<SignInScreen />);
        fireEvent.press(await screen.findByTestId('apple-native-button'));

        await waitFor(() => expect(mockSignInAsync).toHaveBeenCalled());
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(auth.signInWithIdToken).not.toHaveBeenCalled();
        expect(mockShowToast).not.toHaveBeenCalled();
        expect(screen.queryByText('Не удалось выполнить вход через Apple')).toBeNull();
    });

    test('a Supabase failure shows the localized error, not the raw code', async () => {
        mockSignInAsync.mockResolvedValue({
            identityToken: 'apple-id-token',
            authorizationCode: 'code',
            user: 'apple-user',
            fullName: null,
        });
        auth.signInWithIdToken.mockResolvedValue({ data: { session: null, user: null }, error: new Error('provider_disabled') });

        render(<SignInScreen />);
        fireEvent.press(await screen.findByTestId('apple-native-button'));

        await waitFor(() =>
            expect(mockShowToast).toHaveBeenCalledWith('Не удалось выполнить вход через Apple', 'error'),
        );
    });

    test('a readable Supabase message is not shown raw either', async () => {
        mockSignInAsync.mockResolvedValue({
            identityToken: 'apple-id-token',
            authorizationCode: 'code',
            user: 'apple-user',
            fullName: null,
        });
        auth.signInWithIdToken.mockResolvedValue({
            data: { session: null, user: null },
            error: Object.assign(new Error('Unacceptable audience in id_token'), { status: 400 }),
        });

        render(<SignInScreen />);
        fireEvent.press(await screen.findByTestId('apple-native-button'));

        await waitFor(() =>
            expect(mockShowToast).toHaveBeenCalledWith('Не удалось выполнить вход через Apple', 'error'),
        );
        expect(mockShowToast).not.toHaveBeenCalledWith(expect.stringContaining('audience'), 'error');
    });

    test('a lost connection keeps the shared network text', async () => {
        mockSignInAsync.mockResolvedValue({
            identityToken: 'apple-id-token',
            authorizationCode: 'code',
            user: 'apple-user',
            fullName: null,
        });
        auth.signInWithIdToken.mockRejectedValue(new TypeError('Network request failed'));

        render(<SignInScreen />);
        fireEvent.press(await screen.findByTestId('apple-native-button'));

        await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith(expect.any(String), 'error'));
        expect(mockShowToast).not.toHaveBeenCalledWith('Не удалось выполнить вход через Apple', 'error');
    });
});

describe('appleFullNameToMetadata', () => {
    test('no name shared gives nothing to store', () => {
        expect(appleFullNameToMetadata(null)).toBeNull();
        expect(appleFullNameToMetadata({ givenName: ' ', familyName: null })).toBeNull();
    });

    test('a given name alone is a full name', () => {
        expect(appleFullNameToMetadata({ givenName: 'Aida' })).toEqual({ full_name: 'Aida', name: 'Aida', given_name: 'Aida' });
    });
});
