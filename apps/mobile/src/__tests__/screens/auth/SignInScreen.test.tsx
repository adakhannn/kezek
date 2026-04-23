/**
 * Smoke test: SignInScreen
 */

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { AppState, Linking } from 'react-native';

import { supabase } from '../../../lib/supabase';
import SignInScreen from '../../../screens/auth/SignInScreen';
import {
    exchangeViaMobileApi,
    getMobileApiUrl,
} from '../../../navigation/useRootNavigationSession';

const mockShowToast = jest.fn();
const mockExchangeViaMobileApi = jest.fn();
const mockGetMobileApiUrl = jest.fn(() => 'https://kezek.kg');
const mockCanOpenURL = jest.fn();
const mockOpenURL = jest.fn();
const mockAppStateListeners = new Set<(state: 'active' | 'background' | 'inactive') => void>();

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
        };
    };

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

        (SecureStore.getItemAsync as jest.Mock).mockReset();
        (SecureStore.setItemAsync as jest.Mock).mockReset();
        (SecureStore.deleteItemAsync as jest.Mock).mockReset();
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
        (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
        (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);

        mockedSupabase.auth.getSession.mockReset();
        mockedSupabase.auth.getSession.mockResolvedValue({
            data: { session: null },
        });

        const fetchMock = jest.fn();
        global.fetch = fetchMock as unknown as typeof fetch;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('СЂРµРЅРґРµСЂРёС‚СЃСЏ Р±РµР· РѕС€РёР±РѕРє', () => {
        render(<SignInScreen />);
        expect(screen.getByText(/Kezek/i)).toBeTruthy();
    });

    test('mobile smoke: СѓСЃРїРµС€РЅС‹Р№ РІС…РѕРґ С‡РµСЂРµР· Telegram', async () => {
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
                'https://t.me/kezek_auth_bot?start=km1_nonce-1',
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

    test('mobile smoke: cancel/timeout РїРµСЂРµРІРѕРґРёС‚ flow РІ РёСЃС‚РµРєС€РёР№', async () => {
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

        expect(screen.queryByText(/РћС‚РєСЂС‹С‚СЊ Telegram СЃРЅРѕРІР°/i)).toBeNull();
        expect(screen.queryByText(/РћС‚РјРµРЅРёС‚СЊ РІС…РѕРґ/i)).toBeNull();
    });

    test('mobile smoke: РїРѕСЃР»Рµ РІРѕР·РІСЂР°С‚Р° РёР· С„РѕРЅР° flow РєРѕСЂСЂРµРєС‚РЅРѕ Р·Р°РІРµСЂС€Р°РµС‚СЃСЏ РїРѕ timeout', async () => {
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
            expect(screen.queryByText(/РћС‚РєСЂС‹С‚СЊ Telegram СЃРЅРѕРІР°/i)).toBeNull();
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
});

