import {
    handleDeepLinkAuth,
    isAuthCallbackUrl,
    exchangeViaMobileApi,
    useRootNavigationSession,
} from '../../navigation/useRootNavigationSession';
import { supabase } from '../../lib/supabase';
import { clearLocalStateOnSessionEnd } from '../../lib/accountLocalState';
import { syncPushRegistration } from '../../lib/pushNotifications';
import { resetAccountSuspendedNoticeForTests } from '../../lib/accountSuspended';
import { logError, logWarn } from '../../lib/log';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Alert, AppState, Linking } from 'react-native';

jest.mock('../../lib/log', () => ({
    ...jest.requireActual('../../lib/log'),
    logError: jest.fn(),
    logWarn: jest.fn(),
}));

jest.mock('../../lib/supabase', () => ({
    supabase: {
        auth: {
            setSession: jest.fn(),
            exchangeCodeForSession: jest.fn(),
            getSession: jest.fn(),
            onAuthStateChange: jest.fn(),
            signOut: jest.fn(),
        },
    },
}));

jest.mock('../../lib/accountLocalState', () => ({
    clearLocalStateOnSessionEnd: jest.fn(),
}));

jest.mock('../../lib/pushNotifications', () => ({
    syncPushRegistration: jest.fn(async () => undefined),
}));

describe('useRootNavigationSession helpers', () => {
    let appStateHandler: ((state: 'active' | 'background' | 'inactive') => void) | null;

    const mockedSupabase = supabase as unknown as {
        auth: {
            setSession: jest.Mock;
            exchangeCodeForSession: jest.Mock;
            getSession: jest.Mock;
            onAuthStateChange: jest.Mock;
            signOut: jest.Mock;
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
        mockedSupabase.auth.signOut.mockResolvedValue({ error: null });
        resetAccountSuspendedNoticeForTests();
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

    test('concurrent deliveries of one callback exchange the code once (KEZEK-MOBILE-4)', async () => {
        const url = 'kezek://auth/callback?code=concurrent-code';
        let finishExchange: (value: { error: null }) => void = () => undefined;
        mockedSupabase.auth.exchangeCodeForSession.mockReturnValueOnce(
            new Promise((resolve) => {
                finishExchange = resolve;
            }),
        );

        // getInitialURL and the 'url' event deliver the same link on a cold start.
        const first = handleDeepLinkAuth(url);
        const second = handleDeepLinkAuth(url);
        finishExchange({ error: null });

        await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
        expect(mockedSupabase.auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    });

    test('an already used code with a session on the device is not an error', async () => {
        mockedSupabase.auth.exchangeCodeForSession.mockResolvedValueOnce({
            error: Object.assign(new Error('invalid flow state, no valid flow state found'), {
                code: 'flow_state_not_found',
                status: 404,
            }),
        });
        mockedSupabase.auth.getSession.mockResolvedValueOnce({
            data: { session: { access_token: 'existing', user: { id: 'user-1' } } },
            error: null,
        });

        await expect(handleDeepLinkAuth('kezek://auth/callback?code=used-code')).resolves.toBe(true);
        expect(logError).not.toHaveBeenCalled();
    });

    test('an already used code without a session is a warning, not an error', async () => {
        mockedSupabase.auth.exchangeCodeForSession.mockResolvedValueOnce({
            error: Object.assign(new Error('invalid flow state'), { code: 'flow_state_not_found', status: 404 }),
        });

        await expect(handleDeepLinkAuth('kezek://auth/callback?code=expired-code')).resolves.toBe(false);
        expect(logError).not.toHaveBeenCalled();
        expect(logWarn).toHaveBeenCalledWith(
            'RootNavigatorSession',
            'Auth callback link expired or already used',
            expect.anything(),
        );
    });

    test('a blocked account on start: signed out locally, told why, no retry and no error report (KEZEK-MOBILE-2)', async () => {
        const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
        mockedSupabase.auth.getSession.mockResolvedValue({
            data: { session: null },
            error: Object.assign(new Error('Database error granting user'), {
                name: 'AuthRetryableFetchError',
                status: 500,
            }),
        });

        const { result } = renderHook(() => useRootNavigationSession());

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.hasSession).toBe(false);
        expect(mockedSupabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
        expect(mockedSupabase.auth.getSession).toHaveBeenCalledTimes(1);
        expect(alertSpy).toHaveBeenCalledWith(
            'Аккаунт заблокирован',
            'Ваш аккаунт заблокирован. Если это ошибка, обратитесь в поддержку.',
        );
        expect(logError).not.toHaveBeenCalled();
        expect(logWarn).toHaveBeenCalledWith(
            'RootNavigatorSession',
            'Account is blocked; signing out on this device',
            expect.anything(),
        );
    });

    test('a generic 500 is not mistaken for a blocked account', async () => {
        const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
        mockedSupabase.auth.getSession.mockResolvedValue({
            data: { session: null },
            error: Object.assign(new Error('Internal server error'), { status: 500 }),
        });

        const { result } = renderHook(() => useRootNavigationSession());

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(alertSpy).not.toHaveBeenCalled();
        expect(mockedSupabase.auth.signOut).not.toHaveBeenCalled();
        expect(logError).toHaveBeenCalledWith('RootNavigatorSession', 'Bootstrap failed', expect.anything());
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

    describe('the previous account is cleared however its session ends (R25-05)', () => {
        type AuthListener = (event: string, session: unknown) => void;
        const sessionOf = (id: string) => ({ access_token: 'a-' + id, user: { id } });

        async function renderSignedIn(id: string) {
            let listener: AuthListener = () => undefined;
            mockedSupabase.auth.getSession.mockResolvedValue({ data: { session: sessionOf(id) }, error: null });
            mockedSupabase.auth.onAuthStateChange.mockImplementation((callback: AuthListener) => {
                listener = callback;
                return { data: { subscription: { unsubscribe: jest.fn() } } };
            });
            const rendered = renderHook(() => useRootNavigationSession());
            await waitFor(() => expect(rendered.result.current.hasSession).toBe(true));
            return { ...rendered, emit: (event: string, session: unknown) => act(() => listener(event, session)) };
        }

        beforeEach(() => {
            jest.mocked(clearLocalStateOnSessionEnd).mockResolvedValue(undefined);
        });

        test('SIGNED_OUT from a revoked or expired token clears the signed-out account', async () => {
            const { result, emit } = await renderSignedIn('user-1');
            emit('TOKEN_REFRESHED', sessionOf('user-1'));
            expect(clearLocalStateOnSessionEnd).not.toHaveBeenCalled();

            emit('SIGNED_OUT', null);

            expect(clearLocalStateOnSessionEnd).toHaveBeenCalledTimes(1);
            expect(clearLocalStateOnSessionEnd).toHaveBeenCalledWith('user-1');
            expect(result.current.hasSession).toBe(false);
        });

        test('another account replacing the session clears the previous one', async () => {
            const { result, emit } = await renderSignedIn('user-1');

            emit('SIGNED_IN', sessionOf('user-2'));

            expect(clearLocalStateOnSessionEnd).toHaveBeenCalledWith('user-1');
            expect(result.current.session?.user.id).toBe('user-2');
        });

        test('push registration follows the signed-in account, after the previous one is cleared', async () => {
            jest.mocked(syncPushRegistration).mockClear();
            const { emit } = await renderSignedIn('user-1');
            await waitFor(() => expect(syncPushRegistration).toHaveBeenCalledWith('user-1'));
            emit('TOKEN_REFRESHED', sessionOf('user-1'));
            let finishClear: () => void = () => undefined;
            jest.mocked(clearLocalStateOnSessionEnd).mockReturnValueOnce(new Promise<void>(resolve => { finishClear = resolve; }));
            emit('SIGNED_IN', sessionOf('user-2'));
            await act(async () => { await Promise.resolve(); });
            expect(syncPushRegistration).toHaveBeenCalledTimes(1);
            await act(async () => { finishClear(); });
            await waitFor(() => expect(syncPushRegistration).toHaveBeenLastCalledWith('user-2'));
            emit('SIGNED_OUT', null);
            expect(syncPushRegistration).toHaveBeenCalledTimes(2);
        });

        test('a session found missing on resume clears the account too', async () => {
            await renderSignedIn('user-1');
            mockedSupabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

            await act(async () => {
                appStateHandler?.('active');
            });

            await waitFor(() => expect(clearLocalStateOnSessionEnd).toHaveBeenCalledWith('user-1'));
        });
    });
});
