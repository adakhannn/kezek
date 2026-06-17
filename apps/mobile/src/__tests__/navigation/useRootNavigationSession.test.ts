import {
    extractHashTokens,
    handleDeepLinkAuth,
    isAuthCallbackUrl,
    tryRestorePendingSession,
    useRootNavigationSession,
} from '../../navigation/useRootNavigationSession';
import { supabase } from '../../lib/supabase';
import { renderHook, waitFor } from '@testing-library/react-native';
import { AppState, Linking } from 'react-native';

jest.mock('../../lib/supabase', () => ({
    supabase: {
        auth: {
            setSession: jest.fn(),
            exchangeCodeForSession: jest.fn(),
            getSession: jest.fn(),
            onAuthStateChange: jest.fn(),
        },
    },
}));

describe('useRootNavigationSession helpers', () => {
    let appStateHandler: ((state: 'active' | 'background' | 'inactive') => void) | null;

    const mockedSupabase = supabase as unknown as {
        auth: {
            setSession: jest.Mock;
            exchangeCodeForSession: jest.Mock;
            getSession: jest.Mock;
            onAuthStateChange: jest.Mock;
        };
    };

    beforeEach(() => {
        appStateHandler = null;
        mockedSupabase.auth.setSession.mockResolvedValue({ error: null });
        mockedSupabase.auth.exchangeCodeForSession.mockResolvedValue({ error: null });
        mockedSupabase.auth.getSession.mockResolvedValue({
            data: { session: null },
            error: null,
        });
        mockedSupabase.auth.onAuthStateChange.mockReturnValue({
            data: {
                subscription: {
                    unsubscribe: jest.fn(),
                },
            },
        });
        global.fetch = jest.fn();
        jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
        jest
            .spyOn(Linking, 'addEventListener')
            .mockImplementation(
                (..._args: Parameters<typeof Linking.addEventListener>) =>
                    ({ remove: jest.fn() } as unknown as ReturnType<typeof Linking.addEventListener>),
            );
        jest
            .spyOn(AppState, 'addEventListener')
            .mockImplementation(
                (_event, handler) => {
                    appStateHandler = handler as typeof appStateHandler;
                    return { remove: jest.fn() } as ReturnType<typeof AppState.addEventListener>;
                },
            );
    });

    afterEach(() => {
        mockedSupabase.auth.setSession.mockReset();
        mockedSupabase.auth.exchangeCodeForSession.mockReset();
        jest.resetAllMocks();
    });

    test('detects auth callback urls', () => {
        expect(isAuthCallbackUrl('kezek://auth/callback?code=123')).toBe(true);
        expect(isAuthCallbackUrl('kezek://home')).toBe(false);
    });

    test('extracts hash tokens from callback url', () => {
        expect(
            extractHashTokens('kezek://auth/callback#access_token=token-1&refresh_token=token-2'),
        ).toEqual({
            accessToken: 'token-1',
            refreshToken: 'token-2',
        });
    });

    test('handles callback urls with access and refresh tokens', async () => {
        const handled = await handleDeepLinkAuth(
            'kezek://auth/callback#access_token=access-1&refresh_token=refresh-1',
            'https://kezek.kg',
        );

        expect(handled).toBe(true);
        expect(mockedSupabase.auth.setSession).toHaveBeenCalledWith({
            access_token: 'access-1',
            refresh_token: 'refresh-1',
        });
    });

    test('does not process the same callback url twice', async () => {
        const callbackUrl = 'kezek://auth/callback#access_token=once-access&refresh_token=once-refresh';

        const firstHandled = await handleDeepLinkAuth(callbackUrl, 'https://kezek.kg');
        const secondHandled = await handleDeepLinkAuth(callbackUrl, 'https://kezek.kg');

        expect(firstHandled).toBe(true);
        expect(secondHandled).toBe(true);
        expect(mockedSupabase.auth.setSession).toHaveBeenCalledTimes(1);
        expect(mockedSupabase.auth.setSession).toHaveBeenCalledWith({
            access_token: 'once-access',
            refresh_token: 'once-refresh',
        });
    });

    test('handles callback urls with exchange_code via mobile api', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({
                accessToken: 'access-2',
                refreshToken: 'refresh-2',
            }),
        });

        const handled = await handleDeepLinkAuth(
            'kezek://callback-mobile?exchange_code=code-123',
            'https://kezek.kg',
        );

        expect(handled).toBe(true);
        expect(global.fetch).toHaveBeenCalledWith(
            'https://kezek.kg/api/auth/mobile-exchange?code=code-123',
            expect.objectContaining({ signal: expect.any(Object) }),
        );
        expect(mockedSupabase.auth.setSession).toHaveBeenCalledWith({
            access_token: 'access-2',
            refresh_token: 'refresh-2',
        });
    });

    test('handles callback urls with oauth code', async () => {
        const handled = await handleDeepLinkAuth(
            'kezek://auth/callback?code=oauth-code',
            'https://kezek.kg',
        );

        expect(handled).toBe(true);
        expect(mockedSupabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('oauth-code');
    });

    test('restores pending session via mobile exchange endpoint', async () => {
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    hasPending: true,
                    code: 'pending-123',
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    accessToken: 'access-3',
                    refreshToken: 'refresh-3',
                }),
            });

        const restored = await tryRestorePendingSession('https://kezek.kg');

        expect(restored).toBe(true);
        expect(global.fetch).toHaveBeenNthCalledWith(
            1,
            'https://kezek.kg/api/auth/mobile-exchange?check=true',
            expect.objectContaining({ signal: expect.any(Object) }),
        );
        expect(global.fetch).toHaveBeenNthCalledWith(
            2,
            'https://kezek.kg/api/auth/mobile-exchange?code=pending-123',
            expect.objectContaining({ signal: expect.any(Object) }),
        );
        expect(mockedSupabase.auth.setSession).toHaveBeenCalledWith({
            access_token: 'access-3',
            refresh_token: 'refresh-3',
        });
    });

    test('cold start deep link: restores session on bootstrap from auth callback url', async () => {
        (Linking.getInitialURL as jest.Mock).mockResolvedValueOnce(
            'kezek://auth/callback#access_token=cold-access&refresh_token=cold-refresh',
        );

        mockedSupabase.auth.getSession
            .mockResolvedValueOnce({
                data: { session: null },
                error: null,
            })
            .mockResolvedValueOnce({
                data: {
                    session: {
                        access_token: 'cold-access',
                        refresh_token: 'cold-refresh',
                    },
                },
                error: null,
            });

        const { result } = renderHook(() => useRootNavigationSession());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        await waitFor(() => {
            expect(result.current.hasSession).toBe(true);
        });

        expect(mockedSupabase.auth.setSession).toHaveBeenCalledWith({
            access_token: 'cold-access',
            refresh_token: 'cold-refresh',
        });
    });

    test('syncs the current auth session when the app returns to foreground', async () => {
        mockedSupabase.auth.getSession
            .mockResolvedValueOnce({
                data: { session: null },
                error: null,
            })
            .mockResolvedValueOnce({
                data: {
                    session: {
                        access_token: 'resume-access',
                        refresh_token: 'resume-refresh',
                    },
                },
                error: null,
            });

        const { result } = renderHook(() => useRootNavigationSession());

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        appStateHandler?.('background');
        expect(mockedSupabase.auth.getSession).toHaveBeenCalledTimes(1);

        appStateHandler?.('active');

        await waitFor(() => {
            expect(result.current.hasSession).toBe(true);
        });
        expect(mockedSupabase.auth.getSession).toHaveBeenCalledTimes(2);
    });
});
