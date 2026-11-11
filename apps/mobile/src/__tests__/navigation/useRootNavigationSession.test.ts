import {
    handleDeepLinkAuth,
    isAuthCallbackUrl,
    exchangeViaMobileApi,
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

    test.each([
        'kezek://auth/callback#access_token=access&refresh_token=refresh',
        'kezek://auth/callback?access_token=access&refresh_token=refresh',
        'kezek://auth/callback?exchange_code=unbound',
        'kezek://callback-mobile?exchange_code=unbound',
        'https://evil.invalid/auth/callback?code=unbound',
    ])('rejects legacy credentials and noncanonical callbacks: %s', async url => {
        expect(await handleDeepLinkAuth(url, 'https://kezek.kg')).toBe(false);
        expect(mockedSupabase.auth.setSession).not.toHaveBeenCalled();
        expect(mockedSupabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test('passes only a native authorization code to the SDK PKCE verifier', async () => {
        const url = 'kezek://auth/callback?code=once-oauth-code';
        expect(await handleDeepLinkAuth(url)).toBe(true);
        expect(await handleDeepLinkAuth(url)).toBe(true);
        expect(mockedSupabase.auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
        expect(mockedSupabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('once-oauth-code');
        expect(mockedSupabase.auth.setSession).not.toHaveBeenCalled();
    });

    test('redeems a provider grant with its initiating verifier over POST', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ data: { accessToken: 'access', refreshToken: 'refresh' } }) });
        await exchangeViaMobileApi('grant', 'https://kezek.kg', 'a'.repeat(64));
        expect(global.fetch).toHaveBeenCalledWith('https://kezek.kg/api/auth/mobile-exchange', expect.objectContaining({ method: 'POST', body: JSON.stringify({ code: 'grant', codeVerifier: 'a'.repeat(64) }) }));
        expect(mockedSupabase.auth.setSession).toHaveBeenCalledWith({ access_token: 'access', refresh_token: 'refresh' });
    });

    test('cannot redeem a grant without a local initiating verifier', async () => {
        await expect(exchangeViaMobileApi('grant', 'https://kezek.kg', '')).rejects.toThrow('proof');
        expect(global.fetch).not.toHaveBeenCalled();
        expect(mockedSupabase.auth.setSession).not.toHaveBeenCalled();
    });

    test('cold start deep link: restores session on bootstrap from auth callback url', async () => {
        (Linking.getInitialURL as jest.Mock).mockResolvedValueOnce(
            'kezek://auth/callback?code=cold-oauth',
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

        expect(mockedSupabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('cold-oauth');
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
        expect(global.fetch).not.toHaveBeenCalled();
    });
});
