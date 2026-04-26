/**
 * Smoke test: SignInScreen
 */

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { AppState, Linking } from 'react-native';

import { supabase } from '../../../lib/supabase';
import SignInScreen from '../../../screens/auth/SignInScreen';
import {
    exchangeViaMobileApi,
    handleDeepLinkAuth,
    getMobileApiUrl,
    tryRestorePendingSession,
} from '../../../navigation/useRootNavigationSession';

const mockShowToast = jest.fn();
const mockExchangeViaMobileApi = jest.fn();
const mockGetMobileApiUrl = jest.fn(() => 'https://kezek.kg');
const mockCanOpenURL = jest.fn();
const mockOpenURL = jest.fn();
const mockOpenAuthSessionAsync = jest.fn();
const mockMaybeCompleteAuthSession = jest.fn();
const mockAppStateListeners = new Set<(state: 'active' | 'background' | 'inactive') => void>();
const mockTrackMobileEvent = jest.fn();

jest.mock('../../../contexts/ToastContext', () => ({
    useToast: () => ({
        showToast: mockShowToast,
    }),
}));

jest.mock('../../../navigation/useRootNavigationSession', () => ({
    exchangeViaMobileApi: (...args: unknown[]) => mockExchangeViaMobileApi(...args),
    getMobileApiUrl: () => mockGetMobileApiUrl(),
    handleDeepLinkAuth: jest.fn(),
    tryRestorePendingSession: jest.fn(),
}));

jest.mock('../../../lib/analytics', () => ({
    trackMobileEvent: (...args: unknown[]) => mockTrackMobileEvent(...args),
}));

function createResponse(payload: unknown, ok = true, status = 200): Response {
    return {
        ok,
        status,
        json: async () => payload,
        text: async () => JSON.stringify(payload),
    } as Response;
}

function emitAppState(state: 'active' | 'background' | 'inactive') {
    mockAppStateListeners.forEach((handler) => handler(state));
}

describe('SignInScreen', () => {
    const mockedSupabase = supabase as unknown as {
        auth: {
            getSession: jest.Mock;
            signInWithOAuth: jest.Mock;
        };
    };
    const mockedHandleDeepLinkAuth = handleDeepLinkAuth as unknown as jest.Mock;
    const mockedTryRestorePendingSession = tryRestorePendingSession as unknown as jest.Mock;

    beforeEach(() => {
        jest.useRealTimers();
        mockShowToast.mockReset();
        mockExchangeViaMobileApi.mockReset();
        mockGetMobileApiUrl.mockReset();
        mockGetMobileApiUrl.mockReturnValue('https://kezek.kg');
        mockCanOpenURL.mockReset();
        mockCanOpenURL.mockResolvedValue(true);
        mockOpenURL.mockReset();
        mockOpenURL.mockResolvedValue(undefined);
        mockAppStateListeners.clear();
        mockOpenAuthSessionAsync.mockReset();
        mockOpenAuthSessionAsync.mockResolvedValue({
            type: 'cancel',
        });
        mockMaybeCompleteAuthSession.mockReset();
        mockTrackMobileEvent.mockReset();

        jest
            .spyOn(AppState, 'addEventListener')
            .mockImplementation(
                (_event: 'change', handler: (state: 'active' | 'background' | 'inactive') => void) => {
                    mockAppStateListeners.add(handler);
                    return {
                        remove: () => {
                            mockAppStateListeners.delete(handler);
                        },
                    };
                },
            );
        jest
            .spyOn(Linking, 'canOpenURL')
            .mockImplementation((...args: Parameters<typeof Linking.canOpenURL>) =>
                mockCanOpenURL(...args),
            );
        jest
            .spyOn(Linking, 'openURL')
            .mockImplementation((...args: Parameters<typeof Linking.openURL>) =>
                mockOpenURL(...args),
            );
        jest
            .spyOn(WebBrowser, 'openAuthSessionAsync')
            .mockImplementation(
                (...args: Parameters<typeof WebBrowser.openAuthSessionAsync>) =>
                    mockOpenAuthSessionAsync(...args),
            );
        jest
            .spyOn(WebBrowser, 'maybeCompleteAuthSession')
            .mockImplementation(() => {
                mockMaybeCompleteAuthSession();
                return undefined;
            });

        (SecureStore.getItemAsync as jest.Mock).mockReset();
        (SecureStore.setItemAsync as jest.Mock).mockReset();
        (SecureStore.deleteItemAsync as jest.Mock).mockReset();
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
        (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
        (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);

        mockedSupabase.auth.getSession.mockReset();
        mockedSupabase.auth.signInWithOAuth.mockReset();
        mockedSupabase.auth.getSession.mockResolvedValue({
            data: { session: null },
        });
        mockedSupabase.auth.signInWithOAuth.mockResolvedValue({
            data: {
                url: 'https://accounts.google.com/o/oauth2/v2/auth?state=test-state-1',
            },
            error: null,
        });
        mockedHandleDeepLinkAuth.mockReset();
        mockedHandleDeepLinkAuth.mockResolvedValue(true);
        mockedTryRestorePendingSession.mockReset();
        mockedTryRestorePendingSession.mockResolvedValue(false);

        const fetchMock = jest.fn();
        global.fetch = fetchMock as unknown as typeof fetch;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('рендерится без ошибок', () => {
        render(<SignInScreen />);
        expect(screen.getByText(/Kezek/i)).toBeTruthy();
    });

    test('mobile smoke: успешный вход через Telegram', async () => {
        const fetchMock = global.fetch as unknown as jest.Mock;
        fetchMock
            .mockResolvedValueOnce(
                createResponse({
                    data: {
                        nonce: 'nonce-1',
                        botDeepLink: 'https://t.me/kezek_auth_bot?start=km1_nonce-1',
                    },
                }),
            )
            .mockResolvedValueOnce(
                createResponse({
                    data: {
                        status: 'approved',
                        exchangeCode: 'EXCH-1',
                    },
                }),
            );

        mockedSupabase.auth.getSession.mockResolvedValue({
            data: { session: { access_token: 'access', refresh_token: 'refresh' } },
        });

        render(<SignInScreen />);
        fireEvent.press(screen.getByText(/Telegram/i));

        await waitFor(() => {
            expect(mockOpenURL).toHaveBeenCalledWith(
                'tg://resolve?domain=kezek_auth_bot&start=km1_nonce-1',
            );
        });

        await waitFor(() => {
            expect(mockExchangeViaMobileApi).toHaveBeenCalledWith(
                'EXCH-1',
                'https://kezek.kg',
            );
        });

        expect(exchangeViaMobileApi).toBeDefined();
        expect(getMobileApiUrl).toBeDefined();
        expect(mockShowToast).toHaveBeenCalled();
    });

    test('mobile smoke: cancel/timeout переводит flow в истекший', async () => {
        const fetchMock = global.fetch as unknown as jest.Mock;
        fetchMock
            .mockResolvedValueOnce(
                createResponse({
                    data: {
                        nonce: 'nonce-2',
                        botDeepLink: 'https://t.me/kezek_auth_bot?start=km1_nonce-2',
                    },
                }),
            )
            .mockResolvedValueOnce(
                createResponse({
                    data: {
                        status: 'failed',
                    },
                }),
            );

        render(<SignInScreen />);
        fireEvent.press(screen.getByText(/Telegram/i));

        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith(expect.any(String), 'info');
        });

        expect(screen.queryByText(/Открыть Telegram снова/i)).toBeNull();
        expect(screen.queryByText(/Отменить вход/i)).toBeNull();
    });

    test('mobile smoke: после возврата из фона flow корректно завершается по timeout', async () => {
        jest.useFakeTimers();
        let now = 10_000;
        const dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);

        const fetchMock = global.fetch as unknown as jest.Mock;
        fetchMock
            .mockResolvedValueOnce(
                createResponse({
                    data: {
                        nonce: 'nonce-3',
                        botDeepLink: 'https://t.me/kezek_auth_bot?start=km1_nonce-3',
                    },
                }),
            )
            .mockResolvedValueOnce(
                createResponse({
                    data: {
                        status: 'pending',
                    },
                }),
            );

        render(<SignInScreen />);
        fireEvent.press(screen.getByText(/Telegram/i));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith(
                'https://kezek.kg/api/auth/telegram/mobile/status?nonce=nonce-3',
            );
        });

        act(() => {
            emitAppState('background');
        });

        now += 3 * 60 * 1000 + 1;

        await act(async () => {
            emitAppState('active');
        });

        await waitFor(() => {
            expect(screen.queryByText(/Открыть Telegram снова/i)).toBeNull();
        });

        await act(async () => {
            jest.advanceTimersByTime(2600);
        });

        dateNowSpy.mockRestore();
    });
    test('rollback: fallback to web-widget flow when mobile start returns 503', async () => {
        const fetchMock = global.fetch as unknown as jest.Mock;
        fetchMock.mockResolvedValueOnce(
            createResponse(
                {
                    ok: false,
                    error: 'service_unavailable',
                    message: 'Telegram mobile deep-link auth is disabled by feature flag',
                },
                false,
                503,
            ),
        );

        render(<SignInScreen />);
        fireEvent.press(screen.getByText(/Telegram/i));

        await waitFor(() => {
            expect(mockOpenURL).toHaveBeenCalledWith(
                expect.stringContaining('/auth/sign-in?redirect='),
            );
        });
    });

    test('google integration: happy-path OAuth success establishes session', async () => {
        mockedSupabase.auth.getSession
            .mockResolvedValueOnce({ data: { session: null } })
            .mockResolvedValueOnce({
                data: { session: { access_token: 'access', refresh_token: 'refresh' } },
            });

        mockOpenAuthSessionAsync.mockResolvedValueOnce({
            type: 'success',
            url: 'kezek://auth/callback?code=oauth-code&state=test-state-1',
        });

        render(<SignInScreen />);
        fireEvent.press(screen.getByText(/Google/i));

        await waitFor(() => {
            expect(mockedSupabase.auth.signInWithOAuth).toHaveBeenCalledWith({
                provider: 'google',
                options: {
                    redirectTo: 'kezek://auth/callback',
                    skipBrowserRedirect: true,
                },
            });
        });

        await waitFor(() => {
            expect(mockedHandleDeepLinkAuth).toHaveBeenCalledWith(
                'kezek://auth/callback?code=oauth-code&state=test-state-1',
                'https://kezek.kg',
            );
        });

        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith('Вход выполнен успешно', 'success');
        });

        expect(mockTrackMobileEvent).toHaveBeenCalledWith(
            expect.objectContaining({ eventType: 'mobile_google_login_started' }),
        );
        expect(mockTrackMobileEvent).toHaveBeenCalledWith(
            expect.objectContaining({ eventType: 'mobile_google_login_callback_received' }),
        );
        expect(mockTrackMobileEvent).toHaveBeenCalledWith(
            expect.objectContaining({ eventType: 'mobile_google_login_success' }),
        );
    });

    test('google integration: cancel scenario shows info toast and cancelled metric', async () => {
        mockOpenAuthSessionAsync.mockResolvedValueOnce({
            type: 'cancel',
        });

        render(<SignInScreen />);
        fireEvent.press(screen.getByText(/Google/i));

        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith('Sign-in was cancelled', 'info');
        });

        expect(mockTrackMobileEvent).toHaveBeenCalledWith(
            expect.objectContaining({ eventType: 'mobile_google_login_cancelled' }),
        );
    });

    test('google integration: network retry path restores session via pending exchange', async () => {
        jest.useFakeTimers();

        mockedSupabase.auth.getSession.mockResolvedValue({
            data: { session: null },
        });
        mockedTryRestorePendingSession.mockImplementationOnce(async () => {
            mockedSupabase.auth.getSession.mockResolvedValue({
                data: { session: { access_token: 'a2', refresh_token: 'r2' } },
            });
            return true;
        });

        mockOpenAuthSessionAsync.mockResolvedValueOnce({
            type: 'success',
            url: 'kezek://auth/callback?code=oauth-code&state=test-state-1',
        });

        render(<SignInScreen />);
        fireEvent.press(screen.getByText(/Google/i));

        await act(async () => {
            jest.advanceTimersByTime(700);
        });

        await waitFor(() => {
            expect(mockedTryRestorePendingSession).toHaveBeenCalledWith('https://kezek.kg');
        });

        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith('Вход выполнен успешно', 'success');
        });

        expect(mockTrackMobileEvent).toHaveBeenCalledWith(
            expect.objectContaining({ eventType: 'mobile_google_login_success' }),
        );
    });

    test('google integration: repeated callback with same url is idempotent', async () => {
        mockedSupabase.auth.getSession.mockResolvedValue({
            data: { session: { access_token: 'access', refresh_token: 'refresh' } },
        });

        mockOpenAuthSessionAsync.mockResolvedValueOnce({
            type: 'success',
            url: 'kezek://auth/callback?code=oauth-code&state=test-state-1',
        });

        render(<SignInScreen />);
        fireEvent.press(screen.getByText(/Google/i));

        await waitFor(() => {
            expect(mockedHandleDeepLinkAuth).toHaveBeenCalledTimes(1);
        });

        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith('Вход выполнен успешно', 'success');
        });

        expect(
            mockTrackMobileEvent.mock.calls.filter(
                ([payload]) => payload?.eventType === 'mobile_google_login_success',
            ).length,
        ).toBe(1);
    });
});


